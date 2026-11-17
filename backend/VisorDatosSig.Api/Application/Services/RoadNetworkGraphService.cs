using System.Data;
using Microsoft.Data.SqlClient;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace VisorDatosSig.Api;

public sealed class RoadNetworkGraphService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<RoadNetworkGraphService> _logger;
    private RoadNetworkGraph? _cachedGraph;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public RoadNetworkGraphService(IConfiguration configuration, ILogger<RoadNetworkGraphService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<RoadNetworkGraph> GetGraphAsync(CancellationToken cancellationToken = default)
    {
        if (_cachedGraph is not null)
            return _cachedGraph;

        await _lock.WaitAsync(cancellationToken);
        try
        {
            if (_cachedGraph is not null)
                return _cachedGraph;

            _cachedGraph = await BuildGraphFromDatabaseAsync(cancellationToken);
            return _cachedGraph;
        }
        finally
        {
            _lock.Release();
        }
    }

    public RoadSnapProjection FindNearestNodeOrEdge(RoadNetworkGraph graph, double lat, double lon) =>
        graph.FindNearestNodeOrEdge(lat, lon);

    public ShortestPathResult? ComputeShortestPath(RoadNetworkGraph graph, int startNode, int endNode) =>
        graph.ComputeShortestPath(startNode, endNode);

    public void InvalidateCache()
    {
        _cachedGraph = null;
    }

    private async Task<RoadNetworkGraph> BuildGraphFromDatabaseAsync(CancellationToken cancellationToken)
    {
        var graph = new RoadNetworkGraph();
        var connectionString = _configuration.GetConnectionString("DefaultConnection")
            ?? _configuration.GetConnectionString("MigrationDb");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            _logger.LogWarning("No connection string found for RoadNetworkGraphService. Returning empty graph.");
            return graph;
        }

        try
        {
            await using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken);

            const string sql = "SELECT IdVia, Geom.STAsText() AS Wkt FROM dbo.[Vias] WHERE Geom IS NOT NULL";
            await using var command = new SqlCommand(sql, connection);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            var wktReader = new WKTReader();
            var nodeIndex = new Dictionary<(long X, long Y), int>();
            var nextNodeId = 1;
            var edgeId = 1;

            while (await reader.ReadAsync(cancellationToken))
            {
                var idVia = reader.GetInt32(0);
                if (reader.IsDBNull(1)) continue;

                var wkt = reader.GetString(1);
                var geometry = wktReader.Read(wkt);

                if (geometry is LineString line)
                {
                    AddLineToGraph(line, idVia, ref edgeId, ref nextNodeId, nodeIndex, graph);
                }
                else if (geometry is MultiLineString multiLine)
                {
                    for (var i = 0; i < multiLine.NumGeometries; i++)
                    {
                        if (multiLine.GetGeometryN(i) is LineString subLine)
                        {
                            AddLineToGraph(subLine, idVia, ref edgeId, ref nextNodeId, nodeIndex, graph);
                        }
                    }
                }
            }

            _logger.LogInformation("Road network graph successfully constructed: {NodeCount} nodes, {EdgeCount} edges.",
                graph.Nodes.Count, graph.Edges.Count);

            return graph;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to build road network graph from database.");
            return graph;
        }
    }

    private static void AddLineToGraph(
        LineString line,
        int idVia,
        ref int edgeId,
        ref int nextNodeId,
        Dictionary<(long X, long Y), int> nodeIndex,
        RoadNetworkGraph graph)
    {
        var coords = line.Coordinates;
        if (coords.Length < 2) return;

        // Vértice de inicio
        var startCoord = coords[0];
        var startKey = (
            (long)Math.Round(startCoord.X * 100000.0),
            (long)Math.Round(startCoord.Y * 100000.0)
        );

        if (!nodeIndex.TryGetValue(startKey, out var startNodeId))
        {
            startNodeId = nextNodeId++;
            nodeIndex[startKey] = startNodeId;
            graph.AddNode(new GraphNode(startNodeId, startCoord));
        }

        // Vértice de fin
        var endCoord = coords[^1];
        var endKey = (
            (long)Math.Round(endCoord.X * 100000.0),
            (long)Math.Round(endCoord.Y * 100000.0)
        );

        if (!nodeIndex.TryGetValue(endKey, out var endNodeId))
        {
            endNodeId = nextNodeId++;
            nodeIndex[endKey] = endNodeId;
            graph.AddNode(new GraphNode(endNodeId, endCoord));
        }

        // Longitud geodésica acumulada de la polilínea
        var lengthMeters = 0.0;
        for (var i = 0; i < coords.Length - 1; i++)
        {
            lengthMeters += RoadNetworkGraph.HaversineDistance(
                coords[i].Y, coords[i].X,
                coords[i + 1].Y, coords[i + 1].X);
        }

        if (lengthMeters <= 0.01) lengthMeters = 1.0; // Evitar peso 0

        graph.AddEdge(new GraphEdge(edgeId++, startNodeId, endNodeId, lengthMeters, line));
    }
}
