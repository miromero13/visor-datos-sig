using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace VisorDatosSig.Api;

public sealed record IssuedTokens(string AccessToken, string RefreshToken, DateTimeOffset AccessExpiresAt, DateTimeOffset RefreshExpiresAt);

public sealed class JwtTokenService
{
    public const string Issuer = "VisorDatosSIG";
    public const string Audience = "VisorDatosSIG.Web";
    public const string AccessCookie = "visor-datos-sig.access";
    public const string RefreshCookie = "visor-datos-sig.refresh";
    private readonly SigningCredentials _credentials;
    private readonly SymmetricSecurityKey _key;
    private readonly SessionRegistry sessions;

    public JwtTokenService(IConfiguration configuration, SessionRegistry sessions)
    {
        this.sessions = sessions;
        var configuredKey = configuration["Jwt:SigningKey"];
        if (string.IsNullOrWhiteSpace(configuredKey) || Encoding.UTF8.GetByteCount(configuredKey) < 32)
            throw new InvalidOperationException("Configuration 'Jwt:SigningKey' is required and must be at least 32 bytes (set Jwt__SigningKey).");
        _key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuredKey));
        _credentials = new SigningCredentials(_key, SecurityAlgorithms.HmacSha256);
    }

    public TokenValidationParameters ValidationParameters => new()
    {
        ValidateIssuer = true, ValidIssuer = Issuer,
        ValidateAudience = true, ValidAudience = Audience,
        ValidateIssuerSigningKey = true, IssuerSigningKey = _key,
        ValidateLifetime = true, ClockSkew = TimeSpan.FromSeconds(30),
        NameClaimType = "login", RoleClaimType = ClaimTypes.Role
    };

    public IssuedTokens Issue(AuthUser user, bool rememberMe, string sessionId)
    {
        var now = DateTimeOffset.UtcNow;
        var accessExpiry = now.AddMinutes(15);
        var refreshExpiry = sessionsExpiry(sessionId);
        return new IssuedTokens(Create(user, "access", accessExpiry, rememberMe, sessionId), Create(user, "refresh", refreshExpiry, rememberMe, sessionId), accessExpiry, refreshExpiry);
    }

    private DateTimeOffset sessionsExpiry(string sessionId) => sessions.Expiry(sessionId);

    public static AuthUser UserFromPrincipal(ClaimsPrincipal principal)
    {
        if (!int.TryParse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id)) throw new SecurityTokenException("JWT subject is invalid.");
        var login = principal.FindFirstValue("login") ?? throw new SecurityTokenException("JWT login is missing.");
        var name = principal.FindFirstValue("display_name") ?? login;
        return new AuthUser(id, login, name, principal.FindAll(ClaimTypes.Role).Select(c => c.Value).ToArray());
    }

    private string Create(AuthUser user, string tokenType, DateTimeOffset expiry, bool rememberMe, string sessionId)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()), new("sid", sessionId), new("login", user.Login),
            new("display_name", user.Name), new("token_type", tokenType), new("remember_me", rememberMe ? "true" : "false")
        };
        claims.AddRange(user.Roles.Select(role => new Claim(ClaimTypes.Role, role)));
        var token = new JwtSecurityToken(Issuer, Audience, claims, DateTime.UtcNow, expiry.UtcDateTime, _credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
