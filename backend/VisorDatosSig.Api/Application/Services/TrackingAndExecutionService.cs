using System.Data;
using Microsoft.Data.SqlClient;

namespace VisorDatosSig.Api;

public sealed record IngestTrackingPointDto(
    int? IdAsignacion,
    double Latitud,
    double Longitud,
    double? VelocidadKmh,
    DateTime? FechaHora,
    string? Evento
);

public sealed record TrackingHistoryPointDto(
    long IdTracking,
    int IdUsuario,
    string Operador,
    int? IdAsignacion,
    double Latitud,
    double Longitud,
    double? VelocidadKmh,
    DateTime FechaHora,
    string? Evento
);

public sealed record MobileExecutionRequest(
    int IdAsignacionDetalle,
    string Estado, // 'Cortado', 'Reconectado', 'Observado'
    string? LecturaMedidor,
    string? Observacion,
    double LatitudEjecucion,
    double LongitudEjecucion
);

public sealed record MobileExecutionResult(
    bool Succeeded,
    string Message,
    double? DistanciaDesvioMetros,
    bool AlertaUbicacion
);

public sealed class TrackingAndExecutionService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<TrackingAndExecutionService> _logger;

    public TrackingAndExecutionService(IConfiguration configuration, ILogger<TrackingAndExecutionService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    private string ConnectionString =>
        _configuration.GetConnectionString("DefaultConnection")
        ?? _configuration.GetConnectionString("MigrationDb")
        ?? throw new InvalidOperationException("Connection string is not configured.");

    public async Task IngestTrackingAsync(int idUsuario, IngestTrackingPointDto point, CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        const string sql = @"
            INSERT INTO dbo.MonitoreoTracking 
                (IdUsuario, IdAsignacion, Latitud, Longitud, VelocidadKmh, FechaHora, Evento)
            VALUES 
                (@IdUsuario, @IdAsignacion, @Latitud, @Longitud, @VelocidadKmh, @FechaHora, @Evento);";

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@IdUsuario", SqlDbType.Int).Value = idUsuario;
        command.Parameters.Add("@IdAsignacion", SqlDbType.Int).Value = (object?)point.IdAsignacion ?? DBNull.Value;
        command.Parameters.Add("@Latitud", SqlDbType.Float).Value = point.Latitud;
        command.Parameters.Add("@Longitud", SqlDbType.Float).Value = point.Longitud;
        command.Parameters.Add("@VelocidadKmh", SqlDbType.Float).Value = (object?)point.VelocidadKmh ?? DBNull.Value;
        command.Parameters.Add("@FechaHora", SqlDbType.DateTime2).Value = point.FechaHora ?? DateTime.UtcNow;
        command.Parameters.Add("@Evento", SqlDbType.NVarChar, 100).Value = (object?)point.Evento ?? DBNull.Value;

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task IngestTrackingBatchAsync(int idUsuario, IReadOnlyList<IngestTrackingPointDto> points, CancellationToken cancellationToken)
    {
        if (points.Count == 0) return;

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction();

        try
        {
            const string sql = @"
                INSERT INTO dbo.MonitoreoTracking 
                    (IdUsuario, IdAsignacion, Latitud, Longitud, VelocidadKmh, FechaHora, Evento)
                VALUES 
                    (@IdUsuario, @IdAsignacion, @Latitud, @Longitud, @VelocidadKmh, @FechaHora, @Evento);";

            foreach (var point in points)
            {
                await using var command = new SqlCommand(sql, connection, transaction);
                command.Parameters.Add("@IdUsuario", SqlDbType.Int).Value = idUsuario;
                command.Parameters.Add("@IdAsignacion", SqlDbType.Int).Value = (object?)point.IdAsignacion ?? DBNull.Value;
                command.Parameters.Add("@Latitud", SqlDbType.Float).Value = point.Latitud;
                command.Parameters.Add("@Longitud", SqlDbType.Float).Value = point.Longitud;
                command.Parameters.Add("@VelocidadKmh", SqlDbType.Float).Value = (object?)point.VelocidadKmh ?? DBNull.Value;
                command.Parameters.Add("@FechaHora", SqlDbType.DateTime2).Value = point.FechaHora ?? DateTime.UtcNow;
                command.Parameters.Add("@Evento", SqlDbType.NVarChar, 100).Value = (object?)point.Evento ?? DBNull.Value;
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<IReadOnlyList<TrackingHistoryPointDto>> GetTrackingHistoryAsync(
        int? idUsuario,
        int? idAsignacion,
        DateTime? fecha,
        CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        var sql = @"
            SELECT t.IdTracking, t.IdUsuario, u.Nombre AS Operador, t.IdAsignacion,
                   t.Latitud, t.Longitud, t.VelocidadKmh, t.FechaHora, t.Evento
            FROM dbo.MonitoreoTracking t
            JOIN dbo.Usuarios u ON u.IdUsuario = t.IdUsuario
            WHERE (@idUsuario IS NULL OR t.IdUsuario = @idUsuario)
              AND (@idAsignacion IS NULL OR t.IdAsignacion = @idAsignacion)
              AND (@fecha IS NULL OR CAST(t.FechaHora AS DATE) = CAST(@fecha AS DATE))
            ORDER BY t.FechaHora ASC;";

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@idUsuario", SqlDbType.Int).Value = (object?)idUsuario ?? DBNull.Value;
        command.Parameters.Add("@idAsignacion", SqlDbType.Int).Value = (object?)idAsignacion ?? DBNull.Value;
        command.Parameters.Add("@fecha", SqlDbType.Date).Value = (object?)fecha?.Date ?? DBNull.Value;

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var list = new List<TrackingHistoryPointDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            list.Add(new TrackingHistoryPointDto(
                reader.GetInt64(0),
                reader.GetInt32(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetInt32(3),
                reader.GetDouble(4),
                reader.GetDouble(5),
                reader.IsDBNull(6) ? null : reader.GetDouble(6),
                reader.GetDateTime(7),
                reader.IsDBNull(8) ? null : reader.GetString(8)
            ));
        }

        return list;
    }

    /// <summary>
    /// Ejecuta el corte o reconexión desde la app móvil.
    /// Valida presencia física comparando las coordenadas GPS capturadas con las del medidor.
    /// Actualiza transaccionalmente el detalle y el estado del código fijo.
    /// </summary>
    public async Task<MobileExecutionResult> ExecuteTaskAsync(
        MobileExecutionRequest request,
        string? fotoUrl,
        CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction();

        try
        {
            // 1. Obtener ubicación original del medidor y tipo de asignación
            const string getDetailSql = @"
                SELECT d.IdCodigo, a.TipoAsignacion,
                       COALESCE(c.Latitud, c.Geom.STY) AS LatMedidor,
                       COALESCE(c.Longitud, c.Geom.STX) AS LonMedidor
                FROM dbo.AsignacionDetalles d
                JOIN dbo.Asignaciones a ON a.IdAsignacion = d.IdAsignacion
                JOIN dbo.CodigosFijos c ON c.IdCodigo = d.IdCodigo
                WHERE d.IdAsignacionDetalle = @idDetalle;";

            int idCodigo;
            string tipoAsignacion;
            double latMedidor, lonMedidor;

            await using (var cmd = new SqlCommand(getDetailSql, connection, transaction))
            {
                cmd.Parameters.Add("@idDetalle", SqlDbType.Int).Value = request.IdAsignacionDetalle;
                await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
                if (!await reader.ReadAsync(cancellationToken))
                {
                    return new MobileExecutionResult(false, "Detalle de orden no encontrado.", null, false);
                }

                idCodigo = reader.GetInt32(0);
                tipoAsignacion = reader.GetString(1);
                latMedidor = reader.GetDouble(2);
                lonMedidor = reader.GetDouble(3);
            }

            // 2. Calcular distancia geodésica entre móvil y medidor (Auditoría antifraude)
            var distanciaDesvio = RoadNetworkGraph.HaversineDistance(
                request.LatitudEjecucion, request.LongitudEjecucion,
                latMedidor, lonMedidor
            );

            // Umbral de alerta por distancia excesiva (ej. más de 60 metros del medidor)
            var alertaDistancia = distanciaDesvio > 60.0;

            // 3. Actualizar dbo.AsignacionDetalles
            const string updateDetailSql = @"
                UPDATE dbo.AsignacionDetalles
                SET Estado = @Estado,
                    LecturaMedidor = @LecturaMedidor,
                    Observacion = @Observacion,
                    FotoEvidenciaUrl = COALESCE(@FotoEvidenciaUrl, FotoEvidenciaUrl),
                    LatitudEjecucion = @LatitudEjecucion,
                    LongitudEjecucion = @LongitudEjecucion,
                    FechaHoraEjecucion = SYSDATETIME(),
                    DistanciaDesvioMetros = @DistanciaDesvio
                WHERE IdAsignacionDetalle = @IdDetalle;";

            await using (var cmd = new SqlCommand(updateDetailSql, connection, transaction))
            {
                cmd.Parameters.Add("@Estado", SqlDbType.VarChar, 20).Value = request.Estado;
                cmd.Parameters.Add("@LecturaMedidor", SqlDbType.VarChar, 50).Value = (object?)request.LecturaMedidor ?? DBNull.Value;
                cmd.Parameters.Add("@Observacion", SqlDbType.NVarChar, 500).Value = (object?)request.Observacion ?? DBNull.Value;
                cmd.Parameters.Add("@FotoEvidenciaUrl", SqlDbType.NVarChar, 500).Value = (object?)fotoUrl ?? DBNull.Value;
                cmd.Parameters.Add("@LatitudEjecucion", SqlDbType.Float).Value = request.LatitudEjecucion;
                cmd.Parameters.Add("@LongitudEjecucion", SqlDbType.Float).Value = request.LongitudEjecucion;
                cmd.Parameters.Add("@DistanciaDesvio", SqlDbType.Float).Value = distanciaDesvio;
                cmd.Parameters.Add("@IdDetalle", SqlDbType.Int).Value = request.IdAsignacionDetalle;
                await cmd.ExecuteNonQueryAsync(cancellationToken);
            }

            // 4. Si el corte o reconexión fue efectivo (no observado), transicionar el estado en dbo.CodigosFijos
            if (request.Estado.Equals("Cortado", StringComparison.OrdinalIgnoreCase))
            {
                const string updateCodigoSql = "UPDATE dbo.CodigosFijos SET Estado = 3 WHERE IdCodigo = @idCodigo;"; // 3 = Cortado
                await using var cmd = new SqlCommand(updateCodigoSql, connection, transaction);
                cmd.Parameters.Add("@idCodigo", SqlDbType.Int).Value = idCodigo;
                await cmd.ExecuteNonQueryAsync(cancellationToken);
            }
            else if (request.Estado.Equals("Reconectado", StringComparison.OrdinalIgnoreCase))
            {
                const string updateCodigoSql = "UPDATE dbo.CodigosFijos SET Estado = 1 WHERE IdCodigo = @idCodigo;"; // 1 = Normal
                await using var cmd = new SqlCommand(updateCodigoSql, connection, transaction);
                cmd.Parameters.Add("@idCodigo", SqlDbType.Int).Value = idCodigo;
                await cmd.ExecuteNonQueryAsync(cancellationToken);
            }

            // 5. Verificar si todas las tareas de la asignación ya están concluidas para finalizar la cabecera
            const string checkFinishedSql = @"
                IF NOT EXISTS (
                    SELECT 1 FROM dbo.AsignacionDetalles
                    WHERE IdAsignacion = (SELECT IdAsignacion FROM dbo.AsignacionDetalles WHERE IdAsignacionDetalle = @idDetalle)
                      AND Estado = 'Pendiente'
                )
                BEGIN
                    UPDATE dbo.Asignaciones
                    SET Estado = 'Finalizada'
                    WHERE IdAsignacion = (SELECT IdAsignacion FROM dbo.AsignacionDetalles WHERE IdAsignacionDetalle = @idDetalle);
                END
                ELSE
                BEGIN
                    UPDATE dbo.Asignaciones
                    SET Estado = 'EnProgreso'
                    WHERE IdAsignacion = (SELECT IdAsignacion FROM dbo.AsignacionDetalles WHERE IdAsignacionDetalle = @idDetalle)
                      AND Estado = 'Asignada';
                END;";

            await using (var cmd = new SqlCommand(checkFinishedSql, connection, transaction))
            {
                cmd.Parameters.Add("@idDetalle", SqlDbType.Int).Value = request.IdAsignacionDetalle;
                await cmd.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);

            var message = alertaDistancia
                ? $"Ejecución registrada con advertencia: el operador se encontraba a {distanciaDesvio:F1} m del medidor."
                : "Ejecución registrada exitosamente y validada geográficamente.";

            return new MobileExecutionResult(true, message, distanciaDesvio, alertaDistancia);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Error executing field task #{DetailId}", request.IdAsignacionDetalle);
            throw;
        }
    }
}
