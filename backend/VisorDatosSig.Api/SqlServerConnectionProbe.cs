using Microsoft.Data.SqlClient;

namespace VisorDatosSig.Api;

public enum ConnectionTestStatus { Connected, MissingConfiguration, ConnectionFailed }

public sealed record ConnectionTestResult(ConnectionTestStatus Status, string Message)
{
    public bool Succeeded => Status == ConnectionTestStatus.Connected;
}

public interface ISqlConnectionProbe
{
    Task<ConnectionTestResult> TestAsync(CancellationToken cancellationToken = default);
}

public sealed class SqlServerConnectionProbe(
    IConfiguration configuration,
    ILogger<SqlServerConnectionProbe> logger) : ISqlConnectionProbe
{
    public async Task<ConnectionTestResult> TestAsync(CancellationToken cancellationToken = default)
    {
        var connectionString = configuration.GetConnectionString("MigrationDb");
        if (string.IsNullOrWhiteSpace(connectionString))
            return new(ConnectionTestStatus.MissingConfiguration,
                "SQL Server connection is not configured. Set ConnectionStrings__MigrationDb and restart the API.");

        try
        {
            await using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken);
            return new(ConnectionTestStatus.Connected, "SQL Server connection succeeded.");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (SqlException exception)
        {
            logger.LogWarning(
                "SQL Server connection probe failed. Provider metadata: Number={Number}, State={State}, Class={Class}",
                exception.Number, exception.State, exception.Class);
            return new(ConnectionTestStatus.ConnectionFailed,
                "Could not connect to SQL Server. Check the server, database, credentials, and network access.");
        }
        catch (Exception exception)
        {
            logger.LogWarning("SQL Server connection probe failed with exception type {ExceptionType}.",
                exception.GetType().FullName);
            return new(ConnectionTestStatus.ConnectionFailed,
                "Could not connect to SQL Server. Check the server, database, credentials, and network access.");
        }
    }
}

public static class MigrationPreflight
{
    public static async Task<bool> RunAsync(ISqlConnectionProbe probe, Func<CancellationToken, Task> migration,
        CancellationToken cancellationToken = default)
    {
        var result = await probe.TestAsync(cancellationToken);
        if (!result.Succeeded) return false;
        await migration(cancellationToken);
        return true;
    }
}
