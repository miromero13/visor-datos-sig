using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
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
builder.Services.AddCors(options => options.AddPolicy("ViteDevelopment", policy =>
    policy.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddSingleton<ISqlConnectionProbe, SqlServerConnectionProbe>();
builder.Services.AddSingleton<AuthService>();
builder.Services.AddSingleton<JwtTokenService>();
var tokenService = new JwtTokenService(builder.Configuration);
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
            if (context.Principal?.FindFirstValue("token_type") != "access") context.Fail("The cookie does not contain an access token.");
            return Task.CompletedTask;
        }
    };
});
builder.Services.AddAuthorization();
var app = builder.Build();
app.UseCors("ViteDevelopment");
app.UseAntiforgery();
app.UseAuthentication();
app.UseAuthorization();

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

app.MapPost("/api/auth/login", async (LoginRequest request, AuthService auth, JwtTokenService tokens, HttpContext context, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Login) || string.IsNullOrEmpty(request.Password)) return AuthProblem();
    AuthUser? user;
    try
    {
        user = await auth.AuthenticateAsync(request.Login, request.Password, cancellationToken);
    }
    catch (AuthenticationInfrastructureException)
    {
        return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "Service Unavailable", detail: "Authentication service unavailable.");
    }
    if (user is null) return AuthProblem();
    var issued = tokens.Issue(user, request.RememberMe);
    WriteCookies(context, tokens, issued, request.RememberMe);
    return Results.Ok(Envelope(user));
}).AllowAnonymous();

app.MapPost("/api/auth/refresh", (HttpContext context, JwtTokenService tokens) =>
{
    var raw = context.Request.Cookies[JwtTokenService.RefreshCookie];
    if (string.IsNullOrWhiteSpace(raw)) return AuthProblem();
    try
    {
        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
        var principal = handler.ValidateToken(raw, tokens.ValidationParameters, out _);
        if (principal.FindFirstValue("token_type") != "refresh") return AuthProblem();
        var user = JwtTokenService.UserFromPrincipal(principal);
        var persistent = principal.FindFirstValue("remember_me") == "true";
        var issued = tokens.Issue(user, persistent);
        WriteCookies(context, tokens, issued, persistent);
        return Results.Ok(Envelope(user));
    }
    catch (SecurityTokenException) { return AuthProblem(); }
    catch (ArgumentException) { return AuthProblem(); }
}).AllowAnonymous();

app.MapGet("/api/auth/session", (ClaimsPrincipal principal) => Results.Ok(Envelope(JwtTokenService.UserFromPrincipal(principal)))).RequireAuthorization();
app.MapGet("/api/auth/me", (ClaimsPrincipal principal) => Results.Ok(Envelope(JwtTokenService.UserFromPrincipal(principal)))).RequireAuthorization();
app.MapPost("/api/auth/change-password", async (ChangePasswordRequest request, ClaimsPrincipal principal, AuthService auth, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length < 8) return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Invalid request", detail: "La nueva contraseña debe tener al menos 8 caracteres.");
    try
    {
        var changed = await auth.ChangePasswordAsync(JwtTokenService.UserFromPrincipal(principal), request.CurrentPassword ?? "", request.NewPassword, cancellationToken);
        return changed ? Results.NoContent() : Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Unauthorized", detail: "No se pudo validar la contraseña actual.");
    }
    catch (AuthenticationInfrastructureException)
    {
        return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "Service Unavailable", detail: "El servicio de autenticación no está disponible.");
    }
}).RequireAuthorization();

app.MapPost("/api/auth/logout", (HttpContext context) =>
{
    var options = new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, Secure = context.Request.IsHttps, Path = "/" };
    context.Response.Cookies.Delete(JwtTokenService.AccessCookie, options);
    context.Response.Cookies.Delete(JwtTokenService.RefreshCookie, options);
    return Results.NoContent();
}).AllowAnonymous();

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
}).RequireAuthorization();

app.Run();

public sealed record LoginRequest(string Login, string Password, bool RememberMe);
public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);
public partial class Program;
