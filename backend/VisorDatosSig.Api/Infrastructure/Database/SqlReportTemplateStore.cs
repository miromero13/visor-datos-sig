using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;

namespace VisorDatosSig.Api;

public sealed class SqlReportTemplateStore(IConfiguration configuration) : IReportTemplateStore
{
    private const string Columns = "IdPlantilla, Nombre, Capa, Configuracion, FechaCreacion, FechaModificacion";

    public async Task<IReadOnlyList<ReportTemplate>> ListAsync(int userId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new SqlCommand($"SELECT {Columns} FROM dbo.PlantillasReporte WHERE IdUsuario = @user ORDER BY FechaModificacion DESC", connection);
        command.Parameters.Add("@user", SqlDbType.Int).Value = userId;
        return await ReadAsync(command, cancellationToken);
    }

    public async Task<ReportTemplate?> GetAsync(int id, int userId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new SqlCommand($"SELECT {Columns} FROM dbo.PlantillasReporte WHERE IdPlantilla = @id AND IdUsuario = @user", connection);
        command.Parameters.Add("@id", SqlDbType.Int).Value = id;
        command.Parameters.Add("@user", SqlDbType.Int).Value = userId;
        return (await ReadAsync(command, cancellationToken)).FirstOrDefault();
    }

    public async Task<int> CountAsync(int userId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new SqlCommand("SELECT COUNT(*) FROM dbo.PlantillasReporte WHERE IdUsuario = @user", connection);
        command.Parameters.Add("@user", SqlDbType.Int).Value = userId;
        return (int)(await command.ExecuteScalarAsync(cancellationToken) ?? 0);
    }

    public async Task<ReportTemplate> CreateAsync(int userId, string name, ReportDefinition definition, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new SqlCommand($"""
            INSERT dbo.PlantillasReporte (IdUsuario, Nombre, Capa, Configuracion)
            OUTPUT inserted.IdPlantilla, inserted.Nombre, inserted.Capa, inserted.Configuracion, inserted.FechaCreacion, inserted.FechaModificacion
            VALUES (@user, @name, @layer, @config)
            """, connection);
        AddValues(command, userId, name, definition);
        return (await ExecuteUniqueAsync(command, cancellationToken)).Single();
    }

    public async Task<ReportTemplate?> UpdateAsync(int id, int userId, string name, ReportDefinition definition, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new SqlCommand($"""
            UPDATE dbo.PlantillasReporte
               SET Nombre = @name, Capa = @layer, Configuracion = @config, FechaModificacion = SYSDATETIME()
            OUTPUT inserted.IdPlantilla, inserted.Nombre, inserted.Capa, inserted.Configuracion, inserted.FechaCreacion, inserted.FechaModificacion
             WHERE IdPlantilla = @id AND IdUsuario = @user
            """, connection);
        AddValues(command, userId, name, definition);
        command.Parameters.Add("@id", SqlDbType.Int).Value = id;
        return (await ExecuteUniqueAsync(command, cancellationToken)).FirstOrDefault();
    }

    public async Task<bool> DeleteAsync(int id, int userId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new SqlCommand("DELETE dbo.PlantillasReporte WHERE IdPlantilla = @id AND IdUsuario = @user", connection);
        command.Parameters.Add("@id", SqlDbType.Int).Value = id;
        command.Parameters.Add("@user", SqlDbType.Int).Value = userId;
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    private static void AddValues(SqlCommand command, int userId, string name, ReportDefinition definition)
    {
        command.Parameters.Add("@user", SqlDbType.Int).Value = userId;
        command.Parameters.Add("@name", SqlDbType.NVarChar, ReportTemplateService.MaxNameLength).Value = name;
        command.Parameters.Add("@layer", SqlDbType.NVarChar, 30).Value = definition.Layer ?? "";
        command.Parameters.Add("@config", SqlDbType.NVarChar, -1).Value = JsonSerializer.Serialize(definition, ReportTemplateService.Json);
    }

    private static async Task<IReadOnlyList<ReportTemplate>> ExecuteUniqueAsync(SqlCommand command, CancellationToken cancellationToken)
    {
        try { return await ReadAsync(command, cancellationToken); }
        catch (SqlException exception) when (exception.Number is 2627 or 2601) { throw new DuplicateTemplateNameException(); }
    }

    private static async Task<IReadOnlyList<ReportTemplate>> ReadAsync(SqlCommand command, CancellationToken cancellationToken)
    {
        var templates = new List<ReportTemplate>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var definition = JsonSerializer.Deserialize<ReportDefinition>(reader.GetString(3), ReportTemplateService.Json)
                ?? new ReportDefinition(reader.GetString(2), null, null, null, null, null, null, null, null, null);
            templates.Add(new(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), definition, reader.GetDateTime(4), reader.GetDateTime(5)));
        }
        return templates;
    }

    private async Task<SqlConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var connectionString = configuration.GetConnectionString("MigrationDb");
        if (string.IsNullOrWhiteSpace(connectionString)) throw new InvalidOperationException("Template database connection is not configured.");
        var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }
}
