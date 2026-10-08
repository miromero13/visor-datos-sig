using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using VisorDatosSig.Api;

if (args.Length > 0 && args[0] == "--migrate-database")
{
    var scriptsPath = DatabaseScriptPath.Find(args.Length > 1 ? args[1] : null);
    if (scriptsPath is null)
    {
        Console.Error.WriteLine("Database migration failed: ScriptDatabase directory was not found. Pass its path as the optional argument.");
        Environment.ExitCode = 1;
        return;
    }
    var migrationBuilder = WebApplication.CreateBuilder(args);
    var result = await new DatabaseScriptRunner(migrationBuilder.Configuration).RunAsync(scriptsPath);
    (result.Succeeded ? Console.Out : Console.Error).WriteLine(result.Message);
    if (!result.Succeeded) Environment.ExitCode = 1;
    return;
}

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddAntiforgery();
builder.Services.AddMapResponseCompression();
builder.Services.AddCors(options => options.AddPolicy("ViteDevelopment", policy =>
    policy.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod().AllowCredentials().WithExposedHeaders("Content-Disposition")));
builder.Services.AddSingleton<ISqlConnectionProbe, SqlServerConnectionProbe>();
builder.Services.AddSingleton<AuthService>();
var sessionRegistry = new SessionRegistry(builder.Configuration);
builder.Services.AddSingleton(sessionRegistry);
builder.Services.AddSingleton<AuthAuditService>();
builder.Services.AddScoped<ShapefileMigrationService>();
builder.Services.AddScoped<CodigoFijoSimulationService>();
builder.Services.AddScoped<LayerQueryService>();
builder.Services.AddScoped<SearchQueryService>();
builder.Services.AddCustomReports();
var tokenService = new JwtTokenService(builder.Configuration, sessionRegistry);
builder.Services.AddSingleton(tokenService);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = tokenService.ValidationParameters;
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            context.Token = context.Request.Cookies[JwtTokenService.AccessCookie];
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            var principal = context.Principal;
            if (principal?.FindFirstValue("token_type") != "access") { context.Fail("The cookie does not contain an access token."); return Task.CompletedTask; }
            var sessions = context.HttpContext.RequestServices.GetRequiredService<SessionRegistry>();
            var audit = context.HttpContext.RequestServices.GetRequiredService<AuthAuditService>();
            var sid = principal?.FindFirstValue("sid");
            var expired = false;
            if (!int.TryParse(principal?.FindFirstValue(JwtRegisteredClaimNames.Sub), out var userId) || !sessions.ValidateAndTouch(sid, userId, out expired))
            {
                if (expired) audit.Record("SessionExpired", userId);
                context.Fail("The session is invalid or expired.");
            }
            return Task.CompletedTask;
        },
        OnForbidden = context =>
        {
            context.HttpContext.RequestServices.GetRequiredService<AuthAuditService>().Record("AccessDenied");
            return Task.CompletedTask;
        }
    };
});
builder.Services.AddAuthorization(options => options.AddPolicy("Administrator", policy => policy.RequireRole("Administrador")));
var app = builder.Build();
app.UseCors("ViteDevelopment");
app.UseAntiforgery();
app.UseAuthentication();
app.UseAuthorization();
app.UseMapResponseCompression();

static object Envelope(AuthUser user) => new { data = new { user = new { id = user.Id, login = user.Login, name = user.Name, roles = user.Roles } }, meta = new { } };
static IResult AuthProblem() => Results.Problem(statusCode: 401, title: "Unauthorized", detail: "Login failed.");
static void WriteCookies(HttpContext context, JwtTokenService tokens, IssuedTokens issued, bool persistent)
{
    var accessOptions = new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, Secure = context.Request.IsHttps, Path = "/" };
    var refreshOptions = new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, Secure = context.Request.IsHttps, Path = "/" };
    if (persistent)
    {
        accessOptions.Expires = issued.AccessExpiresAt;
        refreshOptions.Expires = issued.RefreshExpiresAt;
    }
    context.Response.Cookies.Append(JwtTokenService.AccessCookie, issued.AccessToken, accessOptions);
    context.Response.Cookies.Append(JwtTokenService.RefreshCookie, issued.RefreshToken, refreshOptions);
}

app.MapPost("/api/auth/login", async (LoginRequest request, AuthService auth, JwtTokenService tokens, SessionRegistry sessions, AuthAuditService audit, HttpContext context, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Login) || string.IsNullOrEmpty(request.Password)) { audit.Record("LoginFailed", login: request.Login, reason: "invalid_credentials"); return AuthProblem(); }
    AuthUser? user;
    try
    {
        user = await auth.AuthenticateAsync(request.Login, request.Password, cancellationToken);
    }
    catch (AuthenticationInfrastructureException)
    {
        return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "Service Unavailable", detail: "Authentication service unavailable.");
    }
    if (user is null) { audit.Record("LoginFailed", login: request.Login, reason: "invalid_credentials_or_inactive"); return AuthProblem(); }
    var sid = sessions.Create(user.Id);
    audit.Record("LoginSucceeded", user.Id, user.Login);
    var issued = tokens.Issue(user, request.RememberMe, sid);
    WriteCookies(context, tokens, issued, request.RememberMe);
    return Results.Ok(Envelope(user));
}).AllowAnonymous();

app.MapPost("/api/auth/refresh", (HttpContext context, JwtTokenService tokens, SessionRegistry sessions, AuthAuditService audit) =>
{
    var raw = context.Request.Cookies[JwtTokenService.RefreshCookie];
    if (string.IsNullOrWhiteSpace(raw)) return AuthProblem();
    try
    {
        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
        var principal = handler.ValidateToken(raw, tokens.ValidationParameters, out _);
        if (principal.FindFirstValue("token_type") != "refresh") return AuthProblem();
        var user = JwtTokenService.UserFromPrincipal(principal);
        var sid = principal.FindFirstValue("sid");
        if (!sessions.ValidateAndTouch(sid, user.Id, out var expired)) { if (expired) audit.Record("SessionExpired", user.Id); return AuthProblem(); }
        var persistent = principal.FindFirstValue("remember_me") == "true";
        var issued = tokens.Issue(user, persistent, sid!);
        WriteCookies(context, tokens, issued, persistent);
        return Results.Ok(Envelope(user));
    }
    catch (SecurityTokenException) { return AuthProblem(); }
    catch (ArgumentException) { return AuthProblem(); }
}).AllowAnonymous();

app.MapGet("/api/auth/session", (ClaimsPrincipal principal) => Results.Ok(Envelope(JwtTokenService.UserFromPrincipal(principal)))).RequireAuthorization();
app.MapGet("/api/auth/me", (ClaimsPrincipal principal) => Results.Ok(Envelope(JwtTokenService.UserFromPrincipal(principal)))).RequireAuthorization();
app.MapPost("/api/auth/change-password", async (ChangePasswordRequest request, ClaimsPrincipal principal, AuthService auth, AuthAuditService audit, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length < 8) return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Invalid request", detail: "La nueva contraseña debe tener al menos 8 caracteres.");
    try
    {
        var changed = await auth.ChangePasswordAsync(JwtTokenService.UserFromPrincipal(principal), request.CurrentPassword ?? "", request.NewPassword, cancellationToken);
        if (changed) audit.Record("PasswordChanged", JwtTokenService.UserFromPrincipal(principal).Id);
        return changed ? Results.NoContent() : Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Unauthorized", detail: "No se pudo validar la contraseña actual.");
    }
    catch (AuthenticationInfrastructureException)
    {
        return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "Service Unavailable", detail: "El servicio de autenticación no está disponible.");
    }
}).RequireAuthorization();

app.MapPost("/api/auth/logout", (HttpContext context, SessionRegistry sessions, AuthAuditService audit) =>
{
    var raw = context.Request.Cookies[JwtTokenService.AccessCookie] ?? context.Request.Cookies[JwtTokenService.RefreshCookie];
    if (!string.IsNullOrWhiteSpace(raw)) { try { var principal = new JwtSecurityTokenHandler { MapInboundClaims = false }.ValidateToken(raw, context.RequestServices.GetRequiredService<JwtTokenService>().ValidationParameters, out _); sessions.Revoke(principal.FindFirstValue("sid")); audit.Record("Logout", int.TryParse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id) ? id : null); } catch (SecurityTokenException) { } }
    var options = new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, Secure = context.Request.IsHttps, Path = "/" };
    context.Response.Cookies.Delete(JwtTokenService.AccessCookie, options);
    context.Response.Cookies.Delete(JwtTokenService.RefreshCookie, options);
    return Results.NoContent();
}).AllowAnonymous();

app.MapPost("/api/migrations/validate", async ([FromForm] IFormFileCollection files, ShapefileMigrationService migration, CancellationToken cancellationToken) =>
{
    try
    {
        var result = await migration.ValidateAsync(files, cancellationToken);
        return result.Valid ? Results.Ok(result) : Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Shapefile validation failed", detail: string.Join(" ", result.Errors), extensions: new Dictionary<string, object?> { ["validation"] = result });
    }
    catch (OperationCanceledException) { return Results.Problem(statusCode: 400, title: "Validation cancelled"); }
}).DisableAntiforgery().RequireAuthorization("Administrator");

app.MapPost("/api/migrations/execute", async ([FromForm] IFormFileCollection files, [FromForm] string mode, ShapefileMigrationService migration, ClaimsPrincipal principal, AuthAuditService audit, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    try
    {
        var user = JwtTokenService.UserFromPrincipal(principal);
        var result = await migration.ExecuteAsync(files, mode, user.Id, cancellationToken);
        audit.Record("ShapefileMigrationCompleted", user.Id, reason: mode);
        return Results.Ok(result);
    }
    catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "Invalid migration request", detail: ex.Message); }
    catch (InvalidDataException ex) { return Results.Problem(statusCode: 400, title: "Shapefile validation failed", detail: ex.Message); }
    catch (OperationCanceledException) { audit.Record("ShapefileMigrationCancelled"); return Results.Problem(statusCode: 400, title: "Migration cancelled"); }
    catch (SqlException exception)
    {
        logger.LogError(exception, "Shapefile migration failed in SQL Server. Mode={Mode}", mode);
        audit.Record("ShapefileMigrationFailed", reason: $"sql:{exception.Number}");
        return Results.Problem(statusCode: StatusCodes.Status502BadGateway, title: "Migration database error", detail: "La base de datos rechazó la migración. Revisá la consola del backend para ver el detalle técnico.");
    }
    catch (Exception exception)
    {
        logger.LogError(exception, "Shapefile migration failed before completion. Mode={Mode}", mode);
        audit.Record("ShapefileMigrationFailed", reason: exception.GetType().Name);
        return Results.Problem(statusCode: 500, title: "Migration failed", detail: "La migración no pudo completarse. Revisá la consola del backend para ver el detalle técnico.");
    }
}).DisableAntiforgery().RequireAuthorization("Administrator");

app.MapPost("/api/migrations/codigos-fijos/simulate-states", async (SimulationRequest request, CodigoFijoSimulationService simulation, ClaimsPrincipal principal, AuthAuditService audit, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    if (!request.Confirmed) return Results.Problem(statusCode: 400, title: "Confirmation required", detail: "Confirmá explícitamente la simulación antes de continuar.");
    var user = JwtTokenService.UserFromPrincipal(principal);
    try
    {
        var result = await simulation.SimulateAsync(cancellationToken);
        audit.Record("FixedCodeStatesSimulated", user.Id, reason: $"records:{result.Total}");
        return Results.Ok(result);
    }
    catch (OperationCanceledException)
    {
        audit.Record("FixedCodeStatesSimulationCancelled", user.Id);
        return Results.Problem(statusCode: 400, title: "Simulation outcome uncertain", detail: "La solicitud se interrumpió. Verificá los datos antes de volver a ejecutar; no se puede confirmar el resultado.");
    }
    catch (SqlException exception)
    {
        logger.LogError(exception, "Fixed-code state simulation failed.");
        audit.Record("FixedCodeStatesSimulationFailed", user.Id, reason: $"sql:{exception.Number}");
        return Results.Problem(statusCode: 502, title: "Simulation database error", detail: "La base de datos no pudo completar la simulación. Verificá los datos antes de volver a ejecutar.");
    }
    catch (Exception exception)
    {
        logger.LogError(exception, "Fixed-code state simulation failed.");
        audit.Record("FixedCodeStatesSimulationFailed", user.Id, reason: exception.GetType().Name);
        return Results.Problem(statusCode: 500, title: "Simulation failed", detail: "No se pudo confirmar el resultado de la simulación. Verificá los datos antes de volver a ejecutar.");
    }
}).RequireAuthorization("Administrator");

app.MapGet("/api/layers", (LayerQueryService layers) => Results.Ok(layers.Catalog())).RequireAuthorization();
app.MapGet("/api/search", async (string layer, string? q, int? page, int? pageSize, string? sortBy, string? sortDirection, HttpRequest request, SearchQueryService search, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    try
    {
        var filters = request.Query.Where(x => !new[] { "layer", "q", "page", "pageSize", "sortBy", "sortDirection" }.Contains(x.Key, StringComparer.OrdinalIgnoreCase)).ToDictionary(x => x.Key, x => (string?)x.Value.ToString(), StringComparer.OrdinalIgnoreCase);
        return Results.Ok(await search.SearchAsync(layer, q, page ?? 1, pageSize, sortBy, sortDirection, filters, cancellationToken));
    }
    catch (KeyNotFoundException) { return Results.Problem(statusCode: 404, title: "Layer not found"); }
    catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "Invalid search query", detail: ex.Message); }
    catch (SqlException exception)
    {
        logger.LogError(exception, "Search query failed in SQL Server. Layer={Layer} Page={Page} PageSize={PageSize}", layer, page ?? 1, pageSize ?? SearchQueryService.DefaultPageSize);
        return Results.Problem(statusCode: 503, title: "Search data unavailable", detail: "No se pudieron consultar los resultados.");
    }
}).RequireAuthorization();
app.MapGet("/api/search/options/via-types", async (SearchQueryService search, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(new { data = new { values = await search.GetViaTypesAsync(cancellationToken) } }); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Search options unavailable", detail: "No se pudieron consultar las opciones de vías."); }
}).RequireAuthorization();
app.MapGet("/api/layers/{layer}/geojson", async (string layer, string? bbox, int? limit, int? estado, string? nombre, int? afterId, bool? minimal, LayerQueryService query, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(await query.GeoJsonAsync(layer, bbox, limit, cancellationToken, estado, nombre, afterId, minimal == true)); }
    catch (KeyNotFoundException) { return Results.Problem(statusCode: 404, title: "Layer not found"); }
    catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "Invalid layer query", detail: ex.Message); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Layer data unavailable", detail: "No se pudieron consultar las capas geográficas."); }
}).RequireAuthorization();
app.MapGet("/api/layers/{layer}/extent", async (string layer, LayerQueryService query, CancellationToken cancellationToken) =>
{
    try { var extent = await query.ExtentAsync(layer, cancellationToken); return extent is null ? Results.Problem(statusCode: 404, title: "Layer extent not found") : Results.Ok(extent); }
    catch (KeyNotFoundException) { return Results.Problem(statusCode: 404, title: "Layer not found"); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Layer data unavailable", detail: "No se pudo consultar la extensión de la capa."); }
}).RequireAuthorization();
app.MapGet("/api/layers/{layer}/{id:int}", async (string layer, int id, LayerQueryService query, CancellationToken cancellationToken) =>
{
    try { var feature = await query.DetailAsync(layer, id, cancellationToken); return feature is null ? Results.Problem(statusCode: 404, title: "Feature not found") : Results.Ok(feature); }
    catch (KeyNotFoundException) { return Results.Problem(statusCode: 404, title: "Layer not found"); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Layer data unavailable", detail: "No se pudo consultar el elemento geográfico."); }
}).RequireAuthorization();

app.MapReportExports();
app.MapCustomReports();

app.MapPost("/api/shapefile-sources/analyze", ([FromForm] IFormFileCollection files) =>
{
    var layers = ShapefileSourceAnalyzer.Analyze(files.Select(file => file.FileName));
    return Results.Ok(new { layers });
}).DisableAntiforgery().RequireAuthorization();

app.MapPost("/api/sql-connection/test", async (ISqlConnectionProbe probe, CancellationToken cancellationToken) =>
{
    var result = await probe.TestAsync(cancellationToken);
    var status = result.Status switch
    {
        ConnectionTestStatus.Connected => StatusCodes.Status200OK,
        ConnectionTestStatus.MissingConfiguration => StatusCodes.Status503ServiceUnavailable,
        _ => StatusCodes.Status502BadGateway
    };
    return Results.Json(new { status = result.Status.ToString(), message = result.Message }, statusCode: status);
}).RequireAuthorization("Administrator");

app.Run();

public sealed record LoginRequest(string Login, string Password, bool RememberMe);
public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);
public sealed record SimulationRequest(bool Confirmed);
public partial class Program;
