using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using VisorDatosSig.Api;

if (args.Length > 0 && args[0] == "--migrate-database")
{
    string? specificScript = null;
    string? customPath = null;
    int? commandTimeout = null;

    for (var i = 1; i < args.Length; i++)
    {
        var arg = args[i];
        if (arg.Equals("--timeout", StringComparison.OrdinalIgnoreCase) ||
            arg.Equals("--command-timeout", StringComparison.OrdinalIgnoreCase))
        {
            if (i + 1 < args.Length && int.TryParse(args[i + 1], out var parsedTimeout))
            {
                commandTimeout = parsedTimeout;
                i++;
            }
        }
        else if (arg.StartsWith("--timeout=", StringComparison.OrdinalIgnoreCase))
        {
            if (int.TryParse(arg["--timeout=".Length..], out var parsedTimeout))
                commandTimeout = parsedTimeout;
        }
        else if (arg.StartsWith("--command-timeout=", StringComparison.OrdinalIgnoreCase))
        {
            if (int.TryParse(arg["--command-timeout=".Length..], out var parsedTimeout))
                commandTimeout = parsedTimeout;
        }
        else if (arg.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
        {
            specificScript = arg;
        }
        else
        {
            customPath = arg;
        }
    }

    var scriptsPath = DatabaseScriptPath.Find(customPath);
    if (scriptsPath is null)
    {
        Console.Error.WriteLine("Database migration failed: ScriptDatabase directory was not found. Pass its path as the optional argument.");
        Environment.ExitCode = 1;
        return;
    }
    var migrationBuilder = WebApplication.CreateBuilder(args);
    var runner = new DatabaseScriptRunner(migrationBuilder.Configuration);
    var result = await runner.RunAsync(scriptsPath, specificScript, commandTimeout);
    (result.Succeeded ? Console.Out : Console.Error).WriteLine(result.Message);
    if (!result.Succeeded) Environment.ExitCode = 1;
    return;
}

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddAntiforgery();
builder.Services.AddMapResponseCompression();
var defaultAllowedOrigins = new[]
{
    "http://localhost:5173",
    "http://localhost:5174",
    "https://visordatossig.devhooh.com"
};

var originsFromConfig = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
var configuredOrigins = (originsFromConfig is { Length: > 0 }
    ? originsFromConfig
    : builder.Configuration["CORS_ALLOWED_ORIGINS"]?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    ?? defaultAllowedOrigins;

builder.Services.AddCors(options => options.AddPolicy("ViteDevelopment", policy =>
    policy.SetIsOriginAllowed(origin =>
    {
        if (string.IsNullOrEmpty(origin)) return false;
        if (Uri.TryCreate(origin, UriKind.Absolute, out var uri))
        {
            if (uri.Host == "localhost" || uri.Host == "127.0.0.1") return true;
        }
        return configuredOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase);
    })
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()
    .WithExposedHeaders("Content-Disposition")));
builder.Services.AddSingleton<ISqlConnectionProbe, SqlServerConnectionProbe>();
builder.Services.AddSingleton<AuthService>();
var sessionRegistry = new SessionRegistry(builder.Configuration);
builder.Services.AddSingleton(sessionRegistry);
builder.Services.AddSingleton<AuthAuditService>();
builder.Services.AddScoped<ShapefileMigrationService>();
builder.Services.AddScoped<CodigoFijoSimulationService>();
builder.Services.AddScoped<LayerQueryService>();
builder.Services.AddScoped<SearchQueryService>();
builder.Services.AddScoped<UserManagementService>();
builder.Services.AddSingleton<RoadNetworkGraphService>();
builder.Services.AddScoped<AssignmentService>();
builder.Services.AddScoped<TrackingAndExecutionService>();
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
            var authHeader = context.Request.Headers.Authorization.ToString();
            if (!string.IsNullOrWhiteSpace(authHeader) &&
                authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                context.Token = authHeader["Bearer ".Length..].Trim();
            }
            else
            {
                context.Token = context.Request.Cookies[JwtTokenService.AccessCookie];
            }
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
var uploadsRoot = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsRoot),
    RequestPath = "/uploads"
});
app.UseAntiforgery();
app.UseAuthentication();
app.UseAuthorization();
app.UseMapResponseCompression();

static object Envelope(AuthUser user, IssuedTokens? issued = null) =>
    issued is null
        ? new { data = new { user = new { id = user.Id, login = user.Login, name = user.Name, roles = user.Roles } }, meta = new { } }
        : new
        {
            data = new
            {
                user = new { id = user.Id, login = user.Login, name = user.Name, roles = user.Roles },
                accessToken = issued.AccessToken,
                refreshToken = issued.RefreshToken,
                expiresAt = issued.AccessExpiresAt
            },
            meta = new { }
        };
static IResult AuthProblem() => Results.Problem(statusCode: 401, title: "Unauthorized", detail: "Login failed.");
static void WriteCookies(HttpContext context, JwtTokenService tokens, IssuedTokens issued, bool persistent)
{
    var origin = context.Request.Headers.Origin.ToString();
    var isCrossSiteDomain = origin.Contains("visordatossig.devhooh.com", StringComparison.OrdinalIgnoreCase)
        || context.Request.Host.Host.Contains("api-visordatossig.devhooh.com", StringComparison.OrdinalIgnoreCase);

    var sameSite = isCrossSiteDomain ? SameSiteMode.None : SameSiteMode.Lax;
    var secure = isCrossSiteDomain || context.Request.IsHttps;

    var accessOptions = new CookieOptions { HttpOnly = true, SameSite = sameSite, Secure = secure, Path = "/" };
    var refreshOptions = new CookieOptions { HttpOnly = true, SameSite = sameSite, Secure = secure, Path = "/" };
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
    return Results.Ok(Envelope(user, issued));
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
        return Results.Ok(Envelope(user, issued));
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

app.MapPost("/api/migrations/execute", async ([FromForm] IFormFileCollection files, [FromForm] string mode, ShapefileMigrationService migration, RoadNetworkGraphService roadGraphService, ClaimsPrincipal principal, AuthAuditService audit, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    try
    {
        var user = JwtTokenService.UserFromPrincipal(principal);
        var result = await migration.ExecuteAsync(files, mode, user.Id, cancellationToken);
        roadGraphService.InvalidateCache();
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

app.MapGet("/api/dashboard/summary", async (LayerQueryService query, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(await query.DashboardSummaryAsync(cancellationToken)); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Dashboard data unavailable", detail: "No se pudieron consultar los datos del dashboard."); }
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

// Endpoints de Gestión de Usuarios y Roles (Sólo Administrador)
app.MapGet("/api/users", async (UserManagementService userService, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(await userService.GetUsersAsync(cancellationToken)); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Database unavailable", detail: "No se pudieron consultar los usuarios."); }
}).RequireAuthorization("Administrator");

app.MapPost("/api/users", async (CreateUserRequest request, UserManagementService userService, CancellationToken cancellationToken) =>
{
    try
    {
        var created = await userService.CreateUserAsync(request, cancellationToken);
        return Results.Created($"/api/users/{created?.Id}", created);
    }
    catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "Bad request", detail: ex.Message); }
    catch (InvalidOperationException ex) { return Results.Problem(statusCode: 409, title: "Conflict", detail: ex.Message); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Database unavailable", detail: "Error al crear el usuario."); }
}).RequireAuthorization("Administrator");

app.MapPut("/api/users/{id:int}", async (int id, UpdateUserRequest request, UserManagementService userService, CancellationToken cancellationToken) =>
{
    try
    {
        var updated = await userService.UpdateUserAsync(id, request, cancellationToken);
        return updated ? Results.NoContent() : Results.NotFound();
    }
    catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "Bad request", detail: ex.Message); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Database unavailable", detail: "Error al actualizar el usuario."); }
}).RequireAuthorization("Administrator");

app.MapPatch("/api/users/{id:int}/status", async (int id, UpdateUserStatusRequest request, UserManagementService userService, CancellationToken cancellationToken) =>
{
    try
    {
        var updated = await userService.UpdateUserStatusAsync(id, request.Activo, cancellationToken);
        return updated ? Results.NoContent() : Results.NotFound();
    }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Database unavailable", detail: "Error al actualizar el estado del usuario."); }
}).RequireAuthorization("Administrator");

app.MapGet("/api/roles", async (UserManagementService userService, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(await userService.GetRolesAsync(cancellationToken)); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Database unavailable", detail: "No se pudieron consultar los roles."); }
}).RequireAuthorization("Administrator");

app.MapPost("/api/roles", async (CreateRoleRequest request, UserManagementService userService, CancellationToken cancellationToken) =>
{
    try
    {
        var created = await userService.CreateRoleAsync(request, cancellationToken);
        return Results.Created($"/api/roles/{created?.Id}", created);
    }
    catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "Bad request", detail: ex.Message); }
    catch (InvalidOperationException ex) { return Results.Problem(statusCode: 409, title: "Conflict", detail: ex.Message); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Database unavailable", detail: "Error al crear el rol."); }
}).RequireAuthorization("Administrator");

app.MapPut("/api/roles/{id:int}", async (int id, UpdateRoleRequest request, UserManagementService userService, CancellationToken cancellationToken) =>
{
    try
    {
        var updated = await userService.UpdateRoleAsync(id, request, cancellationToken);
        return updated ? Results.NoContent() : Results.NotFound();
    }
    catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "Bad request", detail: ex.Message); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Database unavailable", detail: "Error al actualizar el rol."); }
}).RequireAuthorization("Administrator");

// Endpoints de Asignaciones y Ruteo con Dijkstra
app.MapGet("/api/asignaciones/operadores", async (AssignmentService assignmentService, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(await assignmentService.GetOperatorsAsync(cancellationToken)); }
    catch (SqlException ex)
    {
        logger.LogError(ex, "Error al consultar operadores: {Message}", ex.Message);
        return Results.Problem(statusCode: 503, title: "Database unavailable", detail: ex.Message);
    }
}).RequireAuthorization();

app.MapPost("/api/asignaciones/calcular-ruta", async (CalculateRouteRequest request, AssignmentService assignmentService, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(await assignmentService.CalculateRouteAsync(request, cancellationToken)); }
    catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "Bad request", detail: ex.Message); }
    catch (SqlException ex)
    {
        logger.LogError(ex, "Error al calcular la ruta: {Message}", ex.Message);
        return Results.Problem(statusCode: 503, title: "Database unavailable", detail: ex.Message);
    }
}).RequireAuthorization();

app.MapPost("/api/asignaciones/guardar", async (SaveAssignmentRequest request, AssignmentService assignmentService, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    try
    {
        var id = await assignmentService.SaveAssignmentAsync(request, cancellationToken);
        return Results.Created($"/api/asignaciones/{id}", new { idAsignacion = id, message = "Asignación guardada exitosamente." });
    }
    catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "Bad request", detail: ex.Message); }
    catch (SqlException ex)
    {
        logger.LogError(ex, "Error al guardar la asignación: {Message}", ex.Message);
        return Results.Problem(statusCode: 503, title: "Database unavailable", detail: ex.Message);
    }
}).RequireAuthorization();

app.MapGet("/api/asignaciones", async (string? tipo, AssignmentService assignmentService, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(await assignmentService.GetAssignmentsAsync(tipo, cancellationToken)); }
    catch (SqlException ex)
    {
        logger.LogError(ex, "Error al consultar asignaciones: {Message}", ex.Message);
        return Results.Problem(statusCode: 503, title: "Database unavailable", detail: ex.Message);
    }
}).RequireAuthorization();

app.MapGet("/api/asignaciones/{id:int}/detalles", async (int id, AssignmentService assignmentService, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(await assignmentService.GetAssignmentDetailsAsync(id, cancellationToken)); }
    catch (SqlException ex)
    {
        logger.LogError(ex, "Error al consultar los detalles de la asignación: {Message}", ex.Message);
        return Results.Problem(statusCode: 503, title: "Database unavailable", detail: ex.Message);
    }
}).RequireAuthorization();

app.MapGet("/api/mobile/mis-asignaciones", async (ClaimsPrincipal principal, AssignmentService assignmentService, CancellationToken cancellationToken) =>
{
    try
    {
        var user = JwtTokenService.UserFromPrincipal(principal);
        return Results.Ok(await assignmentService.GetOperatorActiveAssignmentsAsync(user.Id, cancellationToken));
    }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Database unavailable", detail: "Error al consultar asignaciones del operador."); }
}).RequireAuthorization();

// Endpoints de Monitoreo y Telemetría
app.MapGet("/api/monitoreo/recorridos", async (int? idUsuario, int? idAsignacion, DateTime? fecha, TrackingAndExecutionService trackingService, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(await trackingService.GetTrackingHistoryAsync(idUsuario, idAsignacion, fecha, cancellationToken)); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Database unavailable", detail: "Error al consultar telemetría."); }
}).RequireAuthorization();

app.MapPost("/api/mobile/tracking", async (HttpRequest request, ClaimsPrincipal principal, TrackingAndExecutionService trackingService, CancellationToken cancellationToken) =>
{
    try
    {
        var user = JwtTokenService.UserFromPrincipal(principal);
        using var doc = await System.Text.Json.JsonDocument.ParseAsync(request.Body, cancellationToken: cancellationToken);
        var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        if (doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            var points = System.Text.Json.JsonSerializer.Deserialize<List<IngestTrackingPointDto>>(doc.RootElement.GetRawText(), options) ?? [];
            await trackingService.IngestTrackingBatchAsync(user.Id, points, cancellationToken);
        }
        else if (doc.RootElement.TryGetProperty("points", out var pointsProp) && pointsProp.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            var points = System.Text.Json.JsonSerializer.Deserialize<List<IngestTrackingPointDto>>(pointsProp.GetRawText(), options) ?? [];
            await trackingService.IngestTrackingBatchAsync(user.Id, points, cancellationToken);
        }
        else
        {
            var point = System.Text.Json.JsonSerializer.Deserialize<IngestTrackingPointDto>(doc.RootElement.GetRawText(), options)
                ?? throw new ArgumentException("Payload de telemetría inválido.");
            await trackingService.IngestTrackingAsync(user.Id, point, cancellationToken);
        }

        return Results.Accepted();
    }
    catch (System.Text.Json.JsonException) { return Results.Problem(statusCode: 400, title: "Bad request", detail: "JSON de telemetría inválido."); }
    catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "Bad request", detail: ex.Message); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Database unavailable", detail: "Error al registrar posición."); }
}).RequireAuthorization();

app.MapPost("/api/mobile/ejecutar-corte", async (HttpRequest httpRequest, TrackingAndExecutionService executionService, IWebHostEnvironment environment, CancellationToken cancellationToken) =>
{
    try
    {
        if (!httpRequest.HasFormContentType)
            return Results.Problem(statusCode: 400, title: "Bad request", detail: "Se requiere multipart/form-data.");

        var form = await httpRequest.ReadFormAsync(cancellationToken);
        if (!int.TryParse(form["idAsignacionDetalle"], out var idDetalle) ||
            !double.TryParse(form["latitudEjecucion"], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var lat) ||
            !double.TryParse(form["longitudEjecucion"], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var lon))
        {
            return Results.Problem(statusCode: 400, title: "Bad request", detail: "Parámetros obligatorios inválidos (idAsignacionDetalle, latitud, longitud).");
        }

        var estado = form["estado"].ToString();
        if (!estado.Equals("Cortado", StringComparison.OrdinalIgnoreCase) &&
            !estado.Equals("Reconectado", StringComparison.OrdinalIgnoreCase) &&
            !estado.Equals("Observado", StringComparison.OrdinalIgnoreCase))
        {
            return Results.Problem(statusCode: 400, title: "Bad request", detail: "El estado debe ser 'Cortado', 'Reconectado' u 'Observado'.");
        }

        var lecturaMedidor = form["lecturaMedidor"].ToString();
        var observacion = form["observacion"].ToString();
        if (estado.Equals("Observado", StringComparison.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(observacion))
        {
            return Results.Problem(statusCode: 400, title: "Bad request", detail: "El motivo de observación es obligatorio cuando el estado es 'Observado'.");
        }

        // Procesar foto de evidencia si existe
        string? fotoUrl = null;
        var file = form.Files.GetFile("foto");
        if (file is not null && file.Length > 0)
        {
            var uploadsDir = Path.Combine(environment.ContentRootPath, "uploads", "evidencias");
            Directory.CreateDirectory(uploadsDir);
            var extension = Path.GetExtension(file.FileName);
            var fileName = $"evidencia_{idDetalle}_{Guid.NewGuid():N}{extension}";
            var filePath = Path.Combine(uploadsDir, fileName);
            await using var stream = new FileStream(filePath, FileMode.Create);
            await file.CopyToAsync(stream, cancellationToken);
            fotoUrl = $"/uploads/evidencias/{fileName}";
        }

        var executionRequest = new MobileExecutionRequest(idDetalle, estado, lecturaMedidor, observacion, lat, lon);
        var result = await executionService.ExecuteTaskAsync(executionRequest, fotoUrl, cancellationToken);
        return Results.Ok(result);
    }
    catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "Bad request", detail: ex.Message); }
    catch (SqlException) { return Results.Problem(statusCode: 503, title: "Database unavailable", detail: "Error en base de datos al ejecutar corte."); }
}).DisableAntiforgery().RequireAuthorization();

app.Run();

public sealed record LoginRequest(string Login, string Password, bool RememberMe);
public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);
public sealed record SimulationRequest(bool Confirmed);
public partial class Program;
