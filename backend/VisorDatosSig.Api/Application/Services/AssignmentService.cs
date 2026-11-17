using System.Data;
using Microsoft.Data.SqlClient;
using NetTopologySuite.Geometries;

namespace VisorDatosSig.Api;

public sealed record DeparturePointDto(double Lat, double Lon);

public sealed record CalculateRouteRequest(
    string Tipo,
    int Cantidad,
    DeparturePointDto PuntoPartida
);

public sealed record AssignmentCandidate(
    int IdCodigo,
    int? CodFijo,
    string? Nombre,
    int Estado,
    double Lat,
    double Lon
);

public sealed record SequencedStopDto(
    int Orden,
    int IdCodigo,
    int? CodFijo,
    string? Nombre,
    int Estado,
    double Lat,
    double Lon,
    double DistanciaDesdeAnteriorMeters,
    double DistanciaAcumuladaMeters
);

public sealed record CalculateRouteResult(
    object RutaGeoJson,
    IReadOnlyList<SequencedStopDto> Paradas,
    double DistanciaTotalMeters,
    int TotalParadas
);

public sealed record SaveAssignmentRequest(
    int IdUsuario,
    string Tipo,
    DeparturePointDto PuntoPartida,
    IReadOnlyList<int> IdsCodigosFijos
);

public sealed record AssignmentSummaryDto(
    int IdAsignacion,
    int IdUsuario,
    string Operador,
    string TipoAsignacion,
    DateTime FechaAsignacion,
    double PuntoPartidaLat,
    double PuntoPartidaLon,
    int CantidadCodigos,
    string Estado,
    int Completados,
    int Observados,
    int Pendientes
);

public sealed record AssignmentDetailItemDto(
    int IdAsignacionDetalle,
    int IdAsignacion,
    int IdCodigo,
    int? CodFijo,
    string? Nombre,
    int OrdenSecuencia,
    string Estado,
    string? LecturaMedidor,
    string? Observacion,
    string? FotoEvidenciaUrl,
    double? LatitudEjecucion,
    double? LongitudEjecucion,
    DateTime? FechaHoraEjecucion,
    double? DistanciaDesvioMetros,
    double LatitudMedidor,
    double LongitudMedidor
);

public sealed record MobileAssignmentSheetDto(
    int IdAsignacion,
    string TipoAsignacion,
    DateTime FechaAsignacion,
    string Estado,
    double PuntoPartidaLat,
    double PuntoPartidaLon,
    int CantidadCodigos,
    int Completados,
    int Observados,
    int Pendientes,
    IReadOnlyList<AssignmentDetailItemDto> Paradas
);

public sealed record OperatorWorkloadDto(
    int IdUsuario,
    string Login,
    string Nombre,
    string Rol,
    int TareasPendientesHoy,
    int TareasCompletadasHoy
);

public sealed class AssignmentService
{
    private readonly IConfiguration _configuration;
    private readonly RoadNetworkGraphService _graphService;
    private readonly ILogger<AssignmentService> _logger;

    public AssignmentService(
        IConfiguration configuration,
        RoadNetworkGraphService graphService,
        ILogger<AssignmentService> logger)
    {
        _configuration = configuration;
        _graphService = graphService;
        _logger = logger;
    }

    private string ConnectionString =>
        _configuration.GetConnectionString("DefaultConnection")
        ?? _configuration.GetConnectionString("MigrationDb")
        ?? throw new InvalidOperationException("Connection string is not configured.");

    public async Task<IReadOnlyList<OperatorWorkloadDto>> GetOperatorsAsync(CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        const string sql = @"
            SELECT u.IdUsuario, u.Login, u.Nombre, r.NombreRol,
                   ISNULL(SUM(CASE WHEN d.Estado = 'Pendiente' THEN 1 ELSE 0 END), 0) AS TareasPendientes,
                   ISNULL(SUM(CASE WHEN d.Estado IN ('Cortado', 'Reconectado') THEN 1 ELSE 0 END), 0) AS TareasCompletadas
            FROM dbo.Usuarios u
            JOIN dbo.UsuariosRoles ur ON ur.IdUsuario = u.IdUsuario
            JOIN dbo.Roles r ON r.IdRol = ur.IdRol
            LEFT JOIN dbo.Asignaciones a ON a.IdUsuario = u.IdUsuario 
                 AND CAST(a.FechaAsignacion AS DATE) = CAST(SYSDATETIME() AS DATE)
            LEFT JOIN dbo.AsignacionDetalles d ON d.IdAsignacion = a.IdAsignacion
            WHERE u.Activo = 1 
              AND r.NombreRol IN ('Cortador', 'Reconexion', 'Lecturador')
            GROUP BY u.IdUsuario, u.Login, u.Nombre, r.NombreRol
            ORDER BY u.Nombre;";

        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var list = new List<OperatorWorkloadDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            list.Add(new OperatorWorkloadDto(
                reader.GetInt32(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetInt32(4),
                reader.GetInt32(5)
            ));
        }

        return list;
    }

    /// <summary>
    /// Calcula la ruta óptima utilizando Dijkstra sobre la red vial.
    /// 1. Encuentra los códigos fijos candidatos según el tipo de orden (Para corte o Cortado).
    /// 2. Proyecta punto de inicio y puntos de corte a los segmentos/nodos de la red vial.
    /// 3. Secuencia las paradas con el vecino más próximo (Nearest Neighbor) basado en el costo Dijkstra.
    /// 4. Genera el GeoJSON continuo respetando las calles y los pines 1..N.
    /// </summary>
    public async Task<CalculateRouteResult> CalculateRouteAsync(CalculateRouteRequest request, CancellationToken cancellationToken)
    {
        if (request.Cantidad <= 0)
            throw new ArgumentException("La cantidad de códigos debe ser mayor a 0.");

        var estadoObjetivo = request.Tipo.Equals("Reconexion", StringComparison.OrdinalIgnoreCase) ? 3 : 2; // 2=Para Corte, 3=Cortado

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        const string sql = @"
            SELECT IdCodigo, CodFijo, Nombre, Estado,
                   COALESCE(Latitud, Geom.STY) AS Lat,
                   COALESCE(Longitud, Geom.STX) AS Lon
            FROM dbo.CodigosFijos
            WHERE Estado = @estadoObjetivo
              AND (Latitud IS NOT NULL OR Geom IS NOT NULL);";

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@estadoObjetivo", SqlDbType.TinyInt).Value = estadoObjetivo;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var candidates = new List<AssignmentCandidate>();
        while (await reader.ReadAsync(cancellationToken))
        {
            candidates.Add(new AssignmentCandidate(
                reader.GetInt32(0),
                reader.IsDBNull(1) ? null : reader.GetInt32(1),
                reader.IsDBNull(2) ? null : reader.GetString(2),
                reader.GetByte(3),
                reader.GetDouble(4),
                reader.GetDouble(5)
            ));
        }

        var graph = await _graphService.GetGraphAsync(cancellationToken);
        return BuildSequencedRoute(request.PuntoPartida, candidates, request.Cantidad, graph);
    }

    public static CalculateRouteResult BuildSequencedRoute(
        DeparturePointDto puntoPartida,
        IReadOnlyList<AssignmentCandidate> candidates,
        int cantidad,
        RoadNetworkGraph graph)
    {
        if (cantidad <= 0)
            throw new ArgumentException("La cantidad de códigos debe ser mayor a 0.");

        if (candidates.Count == 0)
        {
            return new CalculateRouteResult(
                new { type = "FeatureCollection", features = Array.Empty<object>() },
                [],
                0,
                0
            );
        }

        var selectedCandidates = candidates
            .OrderBy(c => RoadNetworkGraph.HaversineDistance(puntoPartida.Lat, puntoPartida.Lon, c.Lat, c.Lon))
            .Take(cantidad)
            .ToList();

        var sequencedStops = new List<SequencedStopDto>();
        var routeCoordinates = new List<Coordinate>();
        var totalDistance = 0.0;

        var unvisited = new List<AssignmentCandidate>(selectedCandidates);

        var currentLat = puntoPartida.Lat;
        var currentLon = puntoPartida.Lon;
        var currentSnap = graph.FindNearestNodeOrEdge(currentLat, currentLon);
        var currentNodeId = currentSnap.NearestNodeId;

        routeCoordinates.Add(new Coordinate(currentLon, currentLat));
        if (currentNodeId != -1)
        {
            routeCoordinates.Add(new Coordinate(currentSnap.ProjectedLon, currentSnap.ProjectedLat));
        }

        var order = 1;
        while (unvisited.Count > 0)
        {
            var bestIndex = -1;
            var bestDistance = double.MaxValue;
            ShortestPathResult? bestPath = null;
            RoadSnapProjection? bestSnap = null;

            for (var i = 0; i < unvisited.Count; i++)
            {
                var candidate = unvisited[i];
                var targetSnap = graph.FindNearestNodeOrEdge(candidate.Lat, candidate.Lon);

                if (currentNodeId != -1 && targetSnap.NearestNodeId != -1)
                {
                    var path = graph.ComputeShortestPath(currentNodeId, targetSnap.NearestNodeId);
                    if (path is not null)
                    {
                        var totalEstimated = path.TotalDistanceMeters + targetSnap.DistanceToEdgeMeters;
                        if (totalEstimated < bestDistance)
                        {
                            bestDistance = totalEstimated;
                            bestIndex = i;
                            bestPath = path;
                            bestSnap = targetSnap;
                        }
                        continue;
                    }
                }

                // Fallback geodésico si no hay camino en grafo
                var directDist = RoadNetworkGraph.HaversineDistance(currentLat, currentLon, candidate.Lat, candidate.Lon);
                if (directDist < bestDistance)
                {
                    bestDistance = directDist;
                    bestIndex = i;
                    bestPath = null;
                    bestSnap = targetSnap;
                }
            }

            if (bestIndex == -1)
                bestIndex = 0;

            var chosen = unvisited[bestIndex];
            unvisited.RemoveAt(bestIndex);

            // Agregar tramo a la geometría de la ruta (estrictamente sobre las aristas del grafo vial)
            if (bestPath?.FullGeometry is not null)
            {
                var pathCoords = bestPath.FullGeometry.Coordinates;
                for (var k = 0; k < pathCoords.Length; k++)
                {
                    AppendDistinctCoordinate(routeCoordinates, pathCoords[k]);
                }
            }

            if (bestSnap is not null && bestSnap.NearestNodeId != -1)
            {
                AppendDistinctCoordinate(routeCoordinates, new Coordinate(bestSnap.ProjectedLon, bestSnap.ProjectedLat));
            }
            else if (bestPath is null)
            {
                AppendDistinctCoordinate(routeCoordinates, new Coordinate(chosen.Lon, chosen.Lat));
            }

            totalDistance += bestDistance;

            sequencedStops.Add(new SequencedStopDto(
                order,
                chosen.IdCodigo,
                chosen.CodFijo,
                chosen.Nombre,
                chosen.Estado,
                chosen.Lat,
                chosen.Lon,
                bestDistance,
                totalDistance
            ));

            currentLat = chosen.Lat;
            currentLon = chosen.Lon;
            currentNodeId = bestSnap?.NearestNodeId ?? -1;
            order++;
        }

        var features = new List<object>();

        // 1. Línea continua de la ruta sobre el eje vial
        if (routeCoordinates.Count >= 2)
        {
            var lineStringCoords = routeCoordinates.Select(c => new[] { c.X, c.Y }).ToArray();
            features.Add(new
            {
                type = "Feature",
                properties = new
                {
                    featureKind = "RoutePath",
                    stroke = "#2563eb",
                    strokeWidth = 4,
                    distanceMeters = totalDistance
                },
                geometry = new
                {
                    type = "LineString",
                    coordinates = lineStringCoords
                }
            });
        }

        // 2. Punto de partida (Marcador Verde de Origen)
        features.Add(new
        {
            type = "Feature",
            properties = new
            {
                featureKind = "DeparturePoint",
                label = "Punto de Partida",
                color = "#16a34a"
            },
            geometry = new
            {
                type = "Point",
                coordinates = new[] { puntoPartida.Lon, puntoPartida.Lat }
            }
        });

        // 3. Marcadores de paradas ordenadas 1..N
        foreach (var stop in sequencedStops)
        {
            features.Add(new
            {
                type = "Feature",
                id = stop.IdCodigo,
                properties = new
                {
                    featureKind = "SequencedStop",
                    order = stop.Orden,
                    idCodigo = stop.IdCodigo,
                    codFijo = stop.CodFijo,
                    nombre = stop.Nombre,
                    estado = stop.Estado,
                    distanciaAcumulada = stop.DistanciaAcumuladaMeters
                },
                geometry = new
                {
                    type = "Point",
                    coordinates = new[] { stop.Lon, stop.Lat }
                }
            });
        }

        var geoJson = new
        {
            type = "FeatureCollection",
            features
        };

        return new CalculateRouteResult(
            geoJson,
            sequencedStops,
            totalDistance,
            sequencedStops.Count
        );
    }

    private static void AppendDistinctCoordinate(List<Coordinate> list, Coordinate coord)
    {
        if (list.Count == 0)
        {
            list.Add(coord);
            return;
        }

        var last = list[^1];
        if (Math.Abs(last.X - coord.X) > 1e-8 || Math.Abs(last.Y - coord.Y) > 1e-8)
        {
            list.Add(coord);
        }
    }

    public async Task<int> SaveAssignmentAsync(SaveAssignmentRequest request, CancellationToken cancellationToken)
    {
        if (request.IdsCodigosFijos.Count == 0)
            throw new ArgumentException("Debe incluir al menos un código fijo para asignar.");

        if (!request.Tipo.Equals("Corte", StringComparison.OrdinalIgnoreCase) &&
            !request.Tipo.Equals("Reconexion", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("El tipo de asignación debe ser 'Corte' o 'Reconexion'.");
        }

        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = connection.BeginTransaction();

        try
        {
            const string insertHeaderSql = @"
                INSERT INTO dbo.Asignaciones 
                    (IdUsuario, TipoAsignacion, FechaAsignacion, PuntoPartidaLat, PuntoPartidaLon, CantidadCodigos, Estado)
                OUTPUT INSERTED.IdAsignacion
                VALUES 
                    (@IdUsuario, @TipoAsignacion, SYSDATETIME(), @PuntoPartidaLat, @PuntoPartidaLon, @CantidadCodigos, 'Asignada');";

            int idAsignacion;
            await using (var cmd = new SqlCommand(insertHeaderSql, connection, transaction))
            {
                cmd.Parameters.Add("@IdUsuario", SqlDbType.Int).Value = request.IdUsuario;
                cmd.Parameters.Add("@TipoAsignacion", SqlDbType.VarChar, 20).Value = request.Tipo;
                cmd.Parameters.Add("@PuntoPartidaLat", SqlDbType.Float).Value = request.PuntoPartida.Lat;
                cmd.Parameters.Add("@PuntoPartidaLon", SqlDbType.Float).Value = request.PuntoPartida.Lon;
                cmd.Parameters.Add("@CantidadCodigos", SqlDbType.Int).Value = request.IdsCodigosFijos.Count;
                idAsignacion = (int)(await cmd.ExecuteScalarAsync(cancellationToken) ?? 0);
            }

            const string insertDetailSql = @"
                INSERT INTO dbo.AsignacionDetalles 
                    (IdAsignacion, IdCodigo, OrdenSecuencia, Estado)
                VALUES 
                    (@IdAsignacion, @IdCodigo, @OrdenSecuencia, 'Pendiente');";

            for (var i = 0; i < request.IdsCodigosFijos.Count; i++)
            {
                await using var cmd = new SqlCommand(insertDetailSql, connection, transaction);
                cmd.Parameters.Add("@IdAsignacion", SqlDbType.Int).Value = idAsignacion;
                cmd.Parameters.Add("@IdCodigo", SqlDbType.Int).Value = request.IdsCodigosFijos[i];
                cmd.Parameters.Add("@OrdenSecuencia", SqlDbType.Int).Value = i + 1;
                await cmd.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
            return idAsignacion;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<IReadOnlyList<AssignmentSummaryDto>> GetAssignmentsAsync(string? tipo, CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        var sql = @"
            SELECT a.IdAsignacion, a.IdUsuario, u.Nombre AS Operador, a.TipoAsignacion, a.FechaAsignacion,
                   a.PuntoPartidaLat, a.PuntoPartidaLon, a.CantidadCodigos, a.Estado,
                   ISNULL(SUM(CASE WHEN d.Estado IN ('Cortado', 'Reconectado') THEN 1 ELSE 0 END), 0) AS Completados,
                   ISNULL(SUM(CASE WHEN d.Estado = 'Observado' THEN 1 ELSE 0 END), 0) AS Observados,
                   ISNULL(SUM(CASE WHEN d.Estado = 'Pendiente' THEN 1 ELSE 0 END), 0) AS Pendientes
            FROM dbo.Asignaciones a
            JOIN dbo.Usuarios u ON u.IdUsuario = a.IdUsuario
            LEFT JOIN dbo.AsignacionDetalles d ON d.IdAsignacion = a.IdAsignacion
            WHERE (@tipo IS NULL OR a.TipoAsignacion = @tipo)
            GROUP BY a.IdAsignacion, a.IdUsuario, u.Nombre, a.TipoAsignacion, a.FechaAsignacion,
                     a.PuntoPartidaLat, a.PuntoPartidaLon, a.CantidadCodigos, a.Estado
            ORDER BY a.FechaAsignacion DESC;";

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@tipo", SqlDbType.VarChar, 20).Value = (object?)tipo ?? DBNull.Value;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var list = new List<AssignmentSummaryDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            list.Add(new AssignmentSummaryDto(
                reader.GetInt32(0),
                reader.GetInt32(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetDateTime(4),
                reader.GetDouble(5),
                reader.GetDouble(6),
                reader.GetInt32(7),
                reader.GetString(8),
                reader.GetInt32(9),
                reader.GetInt32(10),
                reader.GetInt32(11)
            ));
        }

        return list;
    }

    public async Task<IReadOnlyList<AssignmentDetailItemDto>> GetAssignmentDetailsAsync(int idAsignacion, CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        const string sql = @"
            SELECT d.IdAsignacionDetalle, d.IdAsignacion, d.IdCodigo, c.CodFijo, c.Nombre,
                   d.OrdenSecuencia, d.Estado, d.LecturaMedidor, d.Observacion, d.FotoEvidenciaUrl,
                   d.LatitudEjecucion, d.LongitudEjecucion, d.FechaHoraEjecucion, d.DistanciaDesvioMetros,
                   COALESCE(c.Latitud, c.Geom.STY) AS LatitudMedidor,
                   COALESCE(c.Longitud, c.Geom.STX) AS LongitudMedidor
            FROM dbo.AsignacionDetalles d
            JOIN dbo.CodigosFijos c ON c.IdCodigo = d.IdCodigo
            WHERE d.IdAsignacion = @idAsignacion
            ORDER BY d.OrdenSecuencia ASC;";

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@idAsignacion", SqlDbType.Int).Value = idAsignacion;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var list = new List<AssignmentDetailItemDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            list.Add(new AssignmentDetailItemDto(
                reader.GetInt32(0),
                reader.GetInt32(1),
                reader.GetInt32(2),
                reader.IsDBNull(3) ? null : reader.GetInt32(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.GetInt32(5),
                reader.GetString(6),
                reader.IsDBNull(7) ? null : reader.GetString(7),
                reader.IsDBNull(8) ? null : reader.GetString(8),
                reader.IsDBNull(9) ? null : reader.GetString(9),
                reader.IsDBNull(10) ? null : reader.GetDouble(10),
                reader.IsDBNull(11) ? null : reader.GetDouble(11),
                reader.IsDBNull(12) ? null : reader.GetDateTime(12),
                reader.IsDBNull(13) ? null : reader.GetDouble(13),
                reader.GetDouble(14),
                reader.GetDouble(15)
            ));
        }

        return list;
    }

    public async Task<IReadOnlyList<MobileAssignmentSheetDto>> GetOperatorActiveAssignmentsAsync(int idUsuario, CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync(cancellationToken);

        const string sql = @"
            SELECT a.IdAsignacion, a.TipoAsignacion, a.FechaAsignacion, a.Estado,
                   a.PuntoPartidaLat, a.PuntoPartidaLon, a.CantidadCodigos
            FROM dbo.Asignaciones a
            WHERE a.IdUsuario = @idUsuario
              AND a.Estado IN ('Asignada', 'EnProgreso')
            ORDER BY a.FechaAsignacion DESC;";

        var headers = new List<(int IdAsignacion, string TipoAsignacion, DateTime FechaAsignacion, string Estado, double Lat, double Lon, int Cantidad)>();
        await using (var command = new SqlCommand(sql, connection))
        {
            command.Parameters.Add("@idUsuario", SqlDbType.Int).Value = idUsuario;
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                headers.Add((
                    reader.GetInt32(0),
                    reader.GetString(1),
                    reader.GetDateTime(2),
                    reader.GetString(3),
                    reader.GetDouble(4),
                    reader.GetDouble(5),
                    reader.GetInt32(6)
                ));
            }
        }

        var result = new List<MobileAssignmentSheetDto>(headers.Count);
        foreach (var h in headers)
        {
            var paradas = await GetAssignmentDetailsAsync(h.IdAsignacion, cancellationToken);
            var completados = paradas.Count(p => p.Estado is "Cortado" or "Reconectado");
            var observados = paradas.Count(p => p.Estado == "Observado");
            var pendientes = paradas.Count(p => p.Estado == "Pendiente");

            result.Add(new MobileAssignmentSheetDto(
                h.IdAsignacion,
                h.TipoAsignacion,
                h.FechaAsignacion,
                h.Estado,
                h.Lat,
                h.Lon,
                h.Cantidad,
                completados,
                observados,
                pendientes,
                paradas
            ));
        }

        return result;
    }
}
