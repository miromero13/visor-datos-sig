using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace VisorDatosSig.Api;

public sealed record DatabaseMigrationResult(bool Succeeded, string Message);

public sealed class DatabaseScriptRunner(IConfiguration configuration)
{
    private static readonly string[] ScriptFiles =
    [
        "01_CrearBD.sql",
        "04_Actualizar_CodigosFijos_Estado.sql",
        "05_Optimizar_Relacion_CodigoFijo_Lote.sql",
        "06_Agregar_Nombre_Vias.sql",
        "07_Roles_Usuarios_Menu.sql",
        "08_MenuOpciones_UsuarioMenu.sql"
    ];

    private static readonly Regex GoLine = new(@"^\s*GO\s*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public async Task<DatabaseMigrationResult> RunAsync(string scriptsDirectory, CancellationToken cancellationToken = default)
    {
        var connectionString = configuration.GetConnectionString("MigrationDb");
        if (string.IsNullOrWhiteSpace(connectionString))
            return new(false, "Migration failed: ConnectionStrings:MigrationDb is not configured.");

        try
        {
            // The first script creates VisorDatosSIG when it does not exist, so connect
            // to master before executing it. The script switches to the target database
            // with USE and the same connection is then reused for the remaining batches.
            var sqlConnectionBuilder = new SqlConnectionStringBuilder(connectionString)
            {
                InitialCatalog = "master"
            };
            await using var connection = new SqlConnection(sqlConnectionBuilder.ConnectionString);
            await connection.OpenAsync(cancellationToken);
            foreach (var fileName in ScriptFiles)
            {
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
                var batchNumber = 0;
                foreach (var batch in SplitBatches(sql))
                {
                    batchNumber++;
                    await using var command = connection.CreateCommand();
                    command.CommandText = batch;
                    try
                    {
                        await command.ExecuteNonQueryAsync(cancellationToken);
                    }
                    catch (Exception exception) when (exception is SqlException or InvalidOperationException)
                    {
                        return new(false, $"Migration failed in {fileName}, batch {batchNumber} ({exception.GetType().Name}).");
                    }
                }
            }
            return new(true, "Database migration completed successfully.");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception) when (exception is SqlException or IOException or UnauthorizedAccessException)
        {
            return new(false, $"Migration failed while opening the connection or reading scripts ({exception.GetType().Name}).");
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
