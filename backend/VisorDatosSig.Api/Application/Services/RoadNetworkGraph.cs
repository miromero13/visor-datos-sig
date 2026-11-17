using NetTopologySuite.Geometries;

namespace VisorDatosSig.Api;

public sealed record GraphNode(int Id, Coordinate Coordinate);

public sealed record GraphEdge(int Id, int SourceNodeId, int TargetNodeId, double WeightMeters, LineString Geometry);

public sealed record RoadSnapProjection(
    int NearestNodeId,
    int NearestEdgeId,
    double ProjectedLat,
    double ProjectedLon,
    double DistanceToEdgeMeters,
    double DistanceToNodeMeters
);

public sealed record ShortestPathResult(
    IReadOnlyList<int> NodeIds,
    IReadOnlyList<GraphEdge> Edges,
    double TotalDistanceMeters,
    LineString? FullGeometry
);

public sealed class RoadNetworkGraph
{
    private readonly List<GraphNode> _nodes = [];
    private readonly List<GraphEdge> _edges = [];
    private readonly Dictionary<int, List<GraphEdge>> _adjacency = [];
    private readonly Envelope _bounds = new();

    public IReadOnlyList<GraphNode> Nodes => _nodes;
    public IReadOnlyList<GraphEdge> Edges => _edges;

    public void AddNode(GraphNode node)
    {
        _nodes.Add(node);
        _adjacency[node.Id] = [];
        _bounds.ExpandToInclude(node.Coordinate);
    }

    public void AddEdge(GraphEdge edge)
    {
        _edges.Add(edge);
        if (!_adjacency.ContainsKey(edge.SourceNodeId))
            _adjacency[edge.SourceNodeId] = [];
        if (!_adjacency.ContainsKey(edge.TargetNodeId))
            _adjacency[edge.TargetNodeId] = [];

        _adjacency[edge.SourceNodeId].Add(edge);

        // Calles urbanas son de doble sentido para tránsito peatonal/operativo a menos que se restrinja
        var reverseEdge = new GraphEdge(
            -edge.Id,
            edge.TargetNodeId,
            edge.SourceNodeId,
            edge.WeightMeters,
            (LineString)edge.Geometry.Reverse()
        );
        _adjacency[edge.TargetNodeId].Add(reverseEdge);
    }

    public int FindNearestNode(Coordinate target, out double distanceMeters)
    {
        if (_nodes.Count == 0)
        {
            distanceMeters = double.MaxValue;
            return -1;
        }

        var nearestId = -1;
        var minDistance = double.MaxValue;

        foreach (var node in _nodes)
        {
            var dist = HaversineDistance(target.Y, target.X, node.Coordinate.Y, node.Coordinate.X);
            if (dist < minDistance)
            {
                minDistance = dist;
                nearestId = node.Id;
            }
        }

        distanceMeters = minDistance;
        return nearestId;
    }

    /// <summary>
    /// Proyecta un punto geográfico (punto de partida o medidor) sobre el segmento más cercano del eje vial (road snap)
    /// y devuelve tanto el punto proyectado sobre la arista como el nodo extremo más conveniente de esa arista.
    /// </summary>
    public RoadSnapProjection FindNearestNodeOrEdge(double lat, double lon)
    {
        var target = new Coordinate(lon, lat);

        if (_edges.Count == 0)
        {
            var nodeOnlyId = FindNearestNode(target, out var nodeDist);
            var nodeCoord = _nodes.FirstOrDefault(n => n.Id == nodeOnlyId)?.Coordinate ?? target;
            return new RoadSnapProjection(
                nodeOnlyId,
                -1,
                nodeCoord.Y,
                nodeCoord.X,
                nodeDist,
                nodeDist
            );
        }

        var bestEdgeId = -1;
        var bestEdgeDist = double.MaxValue;
        var bestProjLat = lat;
        var bestProjLon = lon;
        var bestNodeId = -1;
        var bestNodeDist = double.MaxValue;

        foreach (var edge in _edges)
        {
            var coords = edge.Geometry.Coordinates;
            for (var i = 0; i < coords.Length - 1; i++)
            {
                var a = coords[i];
                var b = coords[i + 1];
                var (projLon, projLat) = ProjectPointOntoSegment(lon, lat, a.X, a.Y, b.X, b.Y);
                var distToSegment = HaversineDistance(lat, lon, projLat, projLon);

                if (distToSegment < bestEdgeDist)
                {
                    bestEdgeDist = distToSegment;
                    bestEdgeId = edge.Id;
                    bestProjLat = projLat;
                    bestProjLon = projLon;

                    // Elegir entre el nodo origen o destino de la arista según cuál esté más cerca del punto proyectado
                    var sourceCoord = coords[0];
                    var targetCoord = coords[^1];
                    var distToSource = HaversineDistance(projLat, projLon, sourceCoord.Y, sourceCoord.X);
                    var distToTarget = HaversineDistance(projLat, projLon, targetCoord.Y, targetCoord.X);

                    if (distToSource <= distToTarget)
                    {
                        bestNodeId = edge.SourceNodeId;
                        bestNodeDist = HaversineDistance(lat, lon, sourceCoord.Y, sourceCoord.X);
                    }
                    else
                    {
                        bestNodeId = edge.TargetNodeId;
                        bestNodeDist = HaversineDistance(lat, lon, targetCoord.Y, targetCoord.X);
                    }
                }
            }
        }

        if (bestNodeId == -1)
        {
            bestNodeId = FindNearestNode(target, out bestNodeDist);
        }

        return new RoadSnapProjection(
            bestNodeId,
            bestEdgeId,
            bestProjLat,
            bestProjLon,
            bestEdgeDist,
            bestNodeDist
        );
    }

    private static (double Lon, double Lat) ProjectPointOntoSegment(
        double px, double py,
        double ax, double ay,
        double bx, double by)
    {
        var dx = bx - ax;
        var dy = by - ay;
        var lenSq = dx * dx + dy * dy;
        if (lenSq <= 1e-16)
            return (ax, ay);

        var t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
        t = Math.Clamp(t, 0.0, 1.0);
        return (ax + t * dx, ay + t * dy);
    }

    public ShortestPathResult? ComputeShortestPath(int startNodeId, int endNodeId) =>
        ComputeDijkstra(startNodeId, endNodeId);

    /// <summary>
    /// Algoritmo de Dijkstra para camino más corto sobre la red de aristas de la calle.
    /// Garantiza que nunca atraviesa manzanas porque los movimientos solo ocurren sobre las aristas del grafo vial.
    /// </summary>
    public ShortestPathResult? ComputeDijkstra(int startNodeId, int endNodeId)
    {
        if (!_adjacency.ContainsKey(startNodeId) || !_adjacency.ContainsKey(endNodeId))
            return null;

        if (startNodeId == endNodeId)
        {
            var node = _nodes.FirstOrDefault(n => n.Id == startNodeId);
            return new ShortestPathResult(
                [startNodeId],
                [],
                0,
                node is not null ? new LineString([node.Coordinate, node.Coordinate]) : null
            );
        }

        var distances = new Dictionary<int, double>();
        var previousEdge = new Dictionary<int, GraphEdge>();
        var previousNode = new Dictionary<int, int>();
        var priorityQueue = new PriorityQueue<int, double>();

        distances[startNodeId] = 0;
        priorityQueue.Enqueue(startNodeId, 0);

        while (priorityQueue.Count > 0)
        {
            var current = priorityQueue.Dequeue();

            if (current == endNodeId)
                break;

            var currentDist = distances[current];

            if (!_adjacency.TryGetValue(current, out var edges))
                continue;

            foreach (var edge in edges)
            {
                var neighbor = edge.TargetNodeId;
                var newDist = currentDist + edge.WeightMeters;

                if (!distances.TryGetValue(neighbor, out var existingDist) || newDist < existingDist)
                {
                    distances[neighbor] = newDist;
                    previousEdge[neighbor] = edge;
                    previousNode[neighbor] = current;
                    priorityQueue.Enqueue(neighbor, newDist);
                }
            }
        }

        if (!distances.ContainsKey(endNodeId))
            return null; // No hay conectividad vial entre ambos nodos

        // Reconstrucción del camino
        var pathNodes = new List<int>();
        var pathEdges = new List<GraphEdge>();
        var curr = endNodeId;

        while (curr != startNodeId)
        {
            pathNodes.Add(curr);
            if (previousEdge.TryGetValue(curr, out var edge))
            {
                pathEdges.Add(edge);
                curr = previousNode[curr];
            }
            else
            {
                break;
            }
        }
        pathNodes.Add(startNodeId);
        pathNodes.Reverse();
        pathEdges.Reverse();

        // Concatenar geometrías
        var coordinates = new List<Coordinate>();
        foreach (var edge in pathEdges)
        {
            var edgeCoords = edge.Geometry.Coordinates;
            if (coordinates.Count == 0)
            {
                coordinates.AddRange(edgeCoords);
            }
            else
            {
                // Evitar duplicar vértices adyacentes
                for (var i = 1; i < edgeCoords.Length; i++)
                {
                    coordinates.Add(edgeCoords[i]);
                }
            }
        }

        var fullGeometry = coordinates.Count >= 2 ? new LineString(coordinates.ToArray()) : null;

        return new ShortestPathResult(
            pathNodes,
            pathEdges,
            distances[endNodeId],
            fullGeometry
        );
    }

    /// <summary>
    /// Distancia Haversine en metros entre dos puntos geográficos (Lat, Lon).
    /// </summary>
    public static double HaversineDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double r = 6371000; // Radio medio de la Tierra en metros
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return r * c;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;
}
