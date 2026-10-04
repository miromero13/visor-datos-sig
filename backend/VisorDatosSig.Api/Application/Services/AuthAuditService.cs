namespace VisorDatosSig.Api;

public sealed class AuthAuditService(ILogger<AuthAuditService> logger)
{
    public void Record(string eventName, int? userId = null, string? login = null, string? reason = null) =>
        logger.LogInformation("Authentication event {EventName}; userId={UserId}; login={Login}; reason={Reason}", eventName, userId, login, reason);
}
