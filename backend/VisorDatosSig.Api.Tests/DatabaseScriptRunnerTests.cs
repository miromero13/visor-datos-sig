using Microsoft.Extensions.Configuration;
using Xunit;

namespace VisorDatosSig.Api.Tests;

public sealed class DatabaseScriptRunnerTests
{
    [Fact]
    public void ResolveConfiguration_Uses_Default_600s_And_Sets_ConnectTimeout()
    {
        var inMemory = new Dictionary<string, string?>
        {
            ["ConnectionStrings:MigrationDb"] = "Server=my-vps;Database=VisorDatosSIG;User Id=sa;Password=secret;Encrypt=False;TrustServerCertificate=True"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemory).Build();

        var (connectionString, timeout, targetDb) = DatabaseScriptRunner.ResolveConfiguration(config);

        Assert.Equal(600, timeout);
        Assert.Equal("VisorDatosSIG", targetDb);
        Assert.Contains("Connect Timeout=60", connectionString);
    }

    [Fact]
    public void ResolveConfiguration_Extracts_And_Strips_CommandTimeout_From_ConnectionString()
    {
        var inMemory = new Dictionary<string, string?>
        {
            ["ConnectionStrings:MigrationDb"] = "Server=my-vps;Database=VisorDatosSIG;User Id=sa;Password=secret;Command Timeout=750;Encrypt=False;TrustServerCertificate=True"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemory).Build();

        var (connectionString, timeout, targetDb) = DatabaseScriptRunner.ResolveConfiguration(config);

        Assert.Equal(750, timeout);
        Assert.DoesNotContain("Command Timeout", connectionString);
        Assert.DoesNotContain("CommandTimeout", connectionString);
    }

    [Fact]
    public void ResolveConfiguration_Prefers_Config_Or_Override()
    {
        var inMemory = new Dictionary<string, string?>
        {
            ["ConnectionStrings:MigrationDb"] = "Server=my-vps;Database=CustomDb;User Id=sa;Password=secret;Command Timeout=300;Encrypt=False",
            ["MIGRATION_COMMAND_TIMEOUT"] = "800"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemory).Build();

        var (_, timeoutFromConfig, targetDb) = DatabaseScriptRunner.ResolveConfiguration(config);
        Assert.Equal(800, timeoutFromConfig);
        Assert.Equal("CustomDb", targetDb);

        var (_, timeoutOverridden, _) = DatabaseScriptRunner.ResolveConfiguration(config, timeoutOverride: 1200);
        Assert.Equal(1200, timeoutOverridden);
    }

    [Fact]
    public void ResolveConfiguration_Throws_When_Missing()
    {
        var config = new ConfigurationBuilder().Build();
        Assert.Throws<InvalidOperationException>(() => DatabaseScriptRunner.ResolveConfiguration(config));
    }
}
