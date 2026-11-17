using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace VisorDatosSig.Api;

public sealed record DatabaseMigrationResult(bool Succeeded, string Message);

public sealed class DatabaseScriptRunner(IConfiguration configuration)
{
    public const int DefaultCommandTimeoutSeconds = 600; // 10 minutos por defecto para operaciones espaciales pesadas
    public const int DefaultConnectTimeoutSeconds = 60;   // 60 segundos por defecto para conexiones remotas VPS

    private static readonly string[] ScriptFiles =
    [
        "01_CrearBD.sql",
        "04_Actualizar_CodigosFijos_Estado.sql",
        "05_Optimizar_Relacion_CodigoFijo_Lote.sql",
        "06_Agregar_Nombre_Vias.sql",
        "07_Roles_Usuarios_Menu.sql",
        "08_MenuOpciones_UsuarioMenu.sql",
        "09_PlantillasReporte.sql",
        "10_Asignaciones_Tracking.sql"
    ];

    private static readonly Regex GoLine = new(@"^\s*GO\s*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex CommandTimeoutRegex = new(
        @"(?:^|;)\s*(?:Command\s*Timeout|CommandTimeout)\s*=\s*(\d+)\s*(?:;|$)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static (string ConnectionString, int CommandTimeout, string TargetDatabase) ResolveConfiguration(
        IConfiguration configuration,
        int? timeoutOverride = null)
    {
        var rawConnectionString = configuration.GetConnectionString("MigrationDb");
        if (string.IsNullOrWhiteSpace(rawConnectionString))
            throw new InvalidOperationException("ConnectionStrings:MigrationDb is not configured.");

        // Extraer 'Command Timeout' o 'CommandTimeout' si el usuario lo especificó en la cadena de conexión
        var connectionStringTimeout = ExtractCommandTimeoutFromConnectionString(rawConnectionString, out var cleanConnectionString);

        var configuredTimeout = timeoutOverride
            ?? configuration.GetValue<int?>("DatabaseMigration:CommandTimeoutSeconds")
            ?? configuration.GetValue<int?>("DatabaseMigration:CommandTimeout")
            ?? configuration.GetValue<int?>("Migration:CommandTimeoutSeconds")
            ?? configuration.GetValue<int?>("Migration:CommandTimeout")
            ?? configuration.GetValue<int?>("MIGRATION_COMMAND_TIMEOUT")
            ?? connectionStringTimeout
            ?? DefaultCommandTimeoutSeconds;

        var builder = new SqlConnectionStringBuilder(cleanConnectionString);
        var targetDb = string.IsNullOrWhiteSpace(builder.InitialCatalog) ? "VisorDatosSIG" : builder.InitialCatalog;

        // Asegurar Connect Timeout razonable para VPS remoto si no fue explícitamente configurado (default ADO.NET es 15s)
        if (builder.ConnectTimeout == 15)
        {
            builder.ConnectTimeout = DefaultConnectTimeoutSeconds;
        }

        return (builder.ConnectionString, configuredTimeout, targetDb);
    }

    private static int? ExtractCommandTimeoutFromConnectionString(string connectionString, out string cleanedConnectionString)
    {
        var match = CommandTimeoutRegex.Match(connectionString);
        if (match.Success && int.TryParse(match.Groups[1].Value, out var timeout))
        {
            cleanedConnectionString = CommandTimeoutRegex.Replace(connectionString, ";").Trim(';');
            return timeout;
        }

        cleanedConnectionString = connectionString;
        return null;
    }

    public async Task<DatabaseMigrationResult> RunAsync(
        string scriptsDirectory,
        string? specificScript = null,
        int? timeoutOverride = null,
        CancellationToken cancellationToken = default)
    {
        var rawConnectionString = configuration.GetConnectionString("MigrationDb");
        if (string.IsNullOrWhiteSpace(rawConnectionString))
            return new(false, "Migration failed: ConnectionStrings:MigrationDb is not configured.");

        int commandTimeout;
        string masterConnectionString;
        string targetDatabase;

        try
        {
            var (cleanConnStr, timeout, targetDb) = ResolveConfiguration(configuration, timeoutOverride);
            commandTimeout = timeout;
            targetDatabase = targetDb;

            // Se conecta inicialmente a master para asegurar la creación de la base de datos si no existe
            var masterBuilder = new SqlConnectionStringBuilder(cleanConnStr)
            {
                InitialCatalog = "master"
            };
            masterConnectionString = masterBuilder.ConnectionString;
        }
        catch (Exception ex)
        {
            return new(false, $"Migration failed resolving connection configuration: {ex.Message}");
        }

        try
        {
            Console.WriteLine($"[Migration] Starting migrations (Command Timeout: {commandTimeout}s, Target Database: {targetDatabase})...");
            await using var connection = new SqlConnection(masterConnectionString);
            await connection.OpenAsync(cancellationToken);

            var filesToRun = !string.IsNullOrWhiteSpace(specificScript)
                ? [specificScript]
                : ScriptFiles;

            foreach (var fileName in filesToRun)
            {
                if (fileName == "01_CrearBD.sql")
                {
                    await using var checkDbCmd = connection.CreateCommand();
                    checkDbCmd.CommandText = $"SELECT DB_ID(N'{targetDatabase}');";
                    checkDbCmd.CommandTimeout = commandTimeout;
                    var dbId = await checkDbCmd.ExecuteScalarAsync(cancellationToken);
                    if (dbId is not null && dbId is not DBNull)
                    {
                        await using var checkTblCmd = connection.CreateCommand();
                        checkTblCmd.CommandText = $"USE [{targetDatabase}]; SELECT OBJECT_ID(N'dbo.Usuarios', N'U');";
                        checkTblCmd.CommandTimeout = commandTimeout;
                        var tblId = await checkTblCmd.ExecuteScalarAsync(cancellationToken);
                        if (tblId is not null && tblId is not DBNull)
                        {
                            Console.WriteLine($"[Migration] Database '{targetDatabase}' and core tables already exist. Skipping 01_CrearBD.sql.");
                            // Aseguramos contexto en la base de datos destino
                            await using var switchCmd = connection.CreateCommand();
                            switchCmd.CommandText = $"USE [{targetDatabase}];";
                            switchCmd.CommandTimeout = commandTimeout;
                            await switchCmd.ExecuteNonQueryAsync(cancellationToken);
                            continue;
                        }
                    }
                }

                var path = Path.Combine(scriptsDirectory, fileName);
                string sql;
                try
                {
                    sql = await File.ReadAllTextAsync(path, cancellationToken);
                }
                catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
                {
                    return new(false, $"Migration failed reading {fileName} ({exception.GetType().Name}).");
                }

                var batches = SplitBatches(sql).ToList();
                var batchNumber = 0;
                var scriptWatch = Stopwatch.StartNew();
                Console.WriteLine($"[Migration] Executing {fileName} ({batches.Count} batches)...");

                foreach (var batch in batches)
                {
                    batchNumber++;

                    // Si ya se vincularon lotes previamente, saltar la re-ejecución pesada de sp_ActualizarLoteCodigosFijos
                    if (fileName == "05_Optimizar_Relacion_CodigoFijo_Lote.sql" &&
                        batch.Trim().StartsWith("EXEC dbo.sp_ActualizarLoteCodigosFijos", StringComparison.OrdinalIgnoreCase))
                    {
                        await using var checkLotesCmd = connection.CreateCommand();
                        checkLotesCmd.CommandText = $"USE [{targetDatabase}]; SELECT TOP (1) 1 FROM dbo.CodigosFijos WHERE IdLote IS NOT NULL;";
                        checkLotesCmd.CommandTimeout = commandTimeout;
                        var hasLotes = await checkLotesCmd.ExecuteScalarAsync(cancellationToken);
                        if (hasLotes is not null && hasLotes is not DBNull)
                        {
                            Console.WriteLine($"  -> Batch {batchNumber}/{batches.Count}: CodigosFijos ya cuenta con lotes vinculados. Saltando ejecución pesada.");
                            continue;
                        }
                    }

                    var batchWatch = Stopwatch.StartNew();
                    await using var command = connection.CreateCommand();
                    command.CommandText = batch;
                    command.CommandTimeout = commandTimeout;
                    try
                    {
                        await command.ExecuteNonQueryAsync(cancellationToken);
                        batchWatch.Stop();
                        if (batchWatch.Elapsed.TotalSeconds >= 2.0)
                        {
                            Console.WriteLine($"  -> Batch {batchNumber}/{batches.Count} completed in {batchWatch.Elapsed.TotalSeconds:F1}s.");
                        }
                    }
                    catch (Exception exception) when (exception is SqlException or InvalidOperationException)
                    {
                        batchWatch.Stop();
                        return new(false, $"Migration failed in {fileName}, batch {batchNumber} (elapsed: {batchWatch.Elapsed.TotalSeconds:F1}s): {exception.Message}");
                    }
                }

                scriptWatch.Stop();
                Console.WriteLine($"[Migration] Completed {fileName} in {scriptWatch.Elapsed.TotalSeconds:F1}s.");
            }

            return new(true, "Database migration completed successfully.");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception) when (exception is SqlException or IOException or UnauthorizedAccessException)
        {
            return new(false, $"Migration failed while opening the connection or reading scripts ({exception.GetType().Name}): {exception.Message}");
        }
    }

    private static IEnumerable<string> SplitBatches(string sql)
    {
        using var reader = new StringReader(sql);
        var batch = new List<string>();
        string? line;
        while ((line = reader.ReadLine()) is not null)
        {
            if (GoLine.IsMatch(line))
            {
                var text = string.Join(Environment.NewLine, batch).Trim();
                if (text.Length > 0) yield return text;
                batch.Clear();
            }
            else batch.Add(line);
        }
        var remainder = string.Join(Environment.NewLine, batch).Trim();
        if (remainder.Length > 0) yield return remainder;
    }
}

public static class DatabaseScriptPath
{
    public static string? Find(string? suppliedPath = null)
    {
        if (!string.IsNullOrWhiteSpace(suppliedPath))
            return Directory.Exists(suppliedPath) ? suppliedPath : null;

        for (var directory = new DirectoryInfo(Directory.GetCurrentDirectory()); directory is not null; directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, "ScriptDatabase");
            if (Directory.Exists(candidate)) return candidate;
        }
        return null;
    }
}
