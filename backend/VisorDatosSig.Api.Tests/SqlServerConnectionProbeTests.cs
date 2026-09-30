using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using VisorDatosSig.Api;
using Xunit;

namespace VisorDatosSig.Api.Tests;

public sealed class SqlServerConnectionProbeTests
{
    [Fact]
    public async Task Missing_configuration_is_reported_without_secret_details()
    {
        var probe = new SqlServerConnectionProbe(new ConfigurationBuilder().Build(), new RecordingLogger<SqlServerConnectionProbe>());
        var result = await probe.TestAsync();
        Assert.Equal(ConnectionTestStatus.MissingConfiguration, result.Status);
        Assert.Contains("ConnectionStrings__MigrationDb", result.Message);
    }

    [Fact]
    public async Task Successful_probe_reports_connected()
    {
        var probe = new StubProbe(new(ConnectionTestStatus.Connected, "Connected"));
        var result = await probe.TestAsync();
        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task Failed_sql_connection_is_sanitized()
    {
        const string secret = "Password=never-return-this";
        var settings = new Dictionary<string, string?> { ["ConnectionStrings:MigrationDb"] = "not-a-valid-connection-string;" + secret };
        var logger = new RecordingLogger<SqlServerConnectionProbe>();
        var probe = new SqlServerConnectionProbe(new ConfigurationBuilder().AddInMemoryCollection(settings).Build(), logger);
        var result = await probe.TestAsync();
        Assert.Equal(ConnectionTestStatus.ConnectionFailed, result.Status);
        Assert.Equal("Could not connect to SQL Server. Check the server, database, credentials, and network access.", result.Message);
        Assert.DoesNotContain(secret, logger.Output);
        Assert.DoesNotContain(secret, result.Message);
        Assert.Contains("System.ArgumentException", logger.Output);
    }

    [Fact]
    public async Task Failed_preflight_does_not_invoke_migration()
    {
        var probe = new StubProbe(new(ConnectionTestStatus.ConnectionFailed, "failed"));
        var invoked = false;
        var proceeded = await MigrationPreflight.RunAsync(probe, _ => { invoked = true; return Task.CompletedTask; });
        Assert.False(proceeded);
        Assert.False(invoked);
    }

    private sealed class RecordingLogger<T> : ILogger<T>
    {
        public List<string> Messages { get; } = [];
        public string Output => string.Join("\n", Messages);

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
    }

    private sealed class StubProbe(ConnectionTestResult result) : ISqlConnectionProbe
    {
        public Task<ConnectionTestResult> TestAsync(CancellationToken cancellationToken = default) => Task.FromResult(result);
    }
}
