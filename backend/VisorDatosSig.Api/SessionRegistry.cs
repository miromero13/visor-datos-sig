using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace VisorDatosSig.Api;

public sealed record AuthSession(int UserId, DateTimeOffset CreatedAt, DateTimeOffset LastActivityAt, DateTimeOffset ExpiresAt, bool Revoked);

public sealed class SessionRegistry(IConfiguration configuration)
{
    private readonly ConcurrentDictionary<string, AuthSession> sessions = new();
    private TimeSpan Inactivity => TimeSpan.FromMinutes(ReadPositive("Auth:InactivityMinutes", 30));
    public TimeSpan RefreshLifetime => TimeSpan.FromDays(ReadPositive("Auth:RefreshDays", 14));

    public string Create(int userId)
    {
        var now = DateTimeOffset.UtcNow;
        var id = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        sessions[id] = new AuthSession(userId, now, now, now.Add(RefreshLifetime), false);
        return id;
    }

    public bool ValidateAndTouch(string? id, int userId, out bool expired)
    {
        expired = false;
        if (string.IsNullOrEmpty(id) || !sessions.TryGetValue(id, out var session) || session.UserId != userId || session.Revoked) return false;
        var now = DateTimeOffset.UtcNow;
        if (now >= session.ExpiresAt || now - session.LastActivityAt >= Inactivity)
        {
            expired = true;
            sessions.TryUpdate(id, session with { Revoked = true }, session);
            return false;
        }
        return sessions.TryUpdate(id, session with { LastActivityAt = now }, session);
    }

    public DateTimeOffset Expiry(string id) => sessions.TryGetValue(id, out var session) ? session.ExpiresAt : DateTimeOffset.UtcNow;

    public bool Revoke(string? id)
    {
        if (string.IsNullOrEmpty(id) || !sessions.TryGetValue(id, out var session)) return false;
        return sessions.TryUpdate(id, session with { Revoked = true }, session);
    }

    private int ReadPositive(string key, int fallback) => int.TryParse(configuration[key], out var value) && value > 0 ? value : fallback;
}
