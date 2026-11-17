using NetTopologySuite.Geometries;
using Xunit;

namespace VisorDatosSig.Api.Tests;

public sealed class PhaseTwoRoutingTests
{
    [Fact]
    public void FindNearestNodeOrEdge_projects_point_onto_closest_segment_interior()
    {
        var graph = new RoadNetworkGraph();
        graph.AddNode(new GraphNode(1, new Coordinate(-63.1800, -17.7800)));
        graph.AddNode(new GraphNode(2, new Coordinate(-63.1700, -17.7800)));
        graph.AddEdge(new GraphEdge(
            10,
            1,
            2,
            RoadNetworkGraph.HaversineDistance(-17.7800, -63.1800, -17.7800, -63.1700),
            new LineString([new Coordinate(-63.1800, -17.7800), new Coordinate(-63.1700, -17.7800)])));

        var snap = graph.FindNearestNodeOrEdge(-17.7805, -63.1750);

        Assert.NotEqual(-1, snap.NearestNodeId);
        Assert.Equal(10, Math.Abs(snap.NearestEdgeId));
        Assert.InRange(snap.ProjectedLon, -63.1755, -63.1745);
        Assert.InRange(snap.ProjectedLat, -17.7801, -17.7799);
        Assert.InRange(snap.DistanceToEdgeMeters, 40.0, 70.0);
    }

    [Fact]
    public void ComputeShortestPath_follows_road_network_edges_without_crossing_blocks()
    {
        var graph = new RoadNetworkGraph();
        // Square perimeter around a city block: 1 -> 2 -> 3 -> 4
        var c1 = new Coordinate(-63.1800, -17.7800);
        var c2 = new Coordinate(-63.1790, -17.7800);
        var c3 = new Coordinate(-63.1790, -17.7810);
        var c4 = new Coordinate(-63.1800, -17.7810);

        graph.AddNode(new GraphNode(1, c1));
        graph.AddNode(new GraphNode(2, c2));
        graph.AddNode(new GraphNode(3, c3));
        graph.AddNode(new GraphNode(4, c4));

        graph.AddEdge(new GraphEdge(1, 1, 2, 100.0, new LineString([c1, c2])));
        graph.AddEdge(new GraphEdge(2, 2, 3, 110.0, new LineString([c2, c3])));
        graph.AddEdge(new GraphEdge(3, 1, 4, 500.0, new LineString([c1, c4])));
        graph.AddEdge(new GraphEdge(4, 4, 3, 500.0, new LineString([c4, c3])));

        var path = graph.ComputeShortestPath(1, 3);

        Assert.NotNull(path);
        Assert.Equal([1, 2, 3], path!.NodeIds);
        Assert.Equal(210.0, path.TotalDistanceMeters, 3);
        Assert.NotNull(path.FullGeometry);
        Assert.Equal(3, path.FullGeometry!.NumPoints);
        Assert.Equal(c2.X, path.FullGeometry.Coordinates[1].X, 6);
        Assert.Equal(c2.Y, path.FullGeometry.Coordinates[1].Y, 6);
    }

    [Fact]
    public void SequenceStopsByDijkstra_orders_1_to_N_greedily_along_street_network()
    {
        var graph = new RoadNetworkGraph();
        var c1 = new Coordinate(-63.1800, -17.7800);
        var c2 = new Coordinate(-63.1790, -17.7800);
        var c3 = new Coordinate(-63.1780, -17.7800);
        var c4 = new Coordinate(-63.1770, -17.7800);

        graph.AddNode(new GraphNode(1, c1));
        graph.AddNode(new GraphNode(2, c2));
        graph.AddNode(new GraphNode(3, c3));
        graph.AddNode(new GraphNode(4, c4));

        graph.AddEdge(new GraphEdge(1, 1, 2, 100.0, new LineString([c1, c2])));
        graph.AddEdge(new GraphEdge(2, 2, 3, 100.0, new LineString([c2, c3])));
        graph.AddEdge(new GraphEdge(3, 3, 4, 100.0, new LineString([c3, c4])));

        var candidates = new List<AssignmentCandidate>
        {
            new(IdCodigo: 103, CodFijo: 3003, Nombre: "Cliente Lejano", Estado: 2, Lat: c4.Y, Lon: c4.X),
            new(IdCodigo: 101, CodFijo: 1001, Nombre: "Cliente Cercano", Estado: 2, Lat: c2.Y, Lon: c2.X),
            new(IdCodigo: 102, CodFijo: 2002, Nombre: "Cliente Medio", Estado: 2, Lat: c3.Y, Lon: c3.X)
        };

        var result = AssignmentService.BuildSequencedRoute(
            new DeparturePointDto(c1.Y, c1.X),
            candidates,
            cantidad: 2,
            graph);

        Assert.Equal(2, result.TotalParadas);
        Assert.Equal([1, 2], result.Paradas.Select(p => p.Orden).ToArray());
        Assert.Equal([101, 102], result.Paradas.Select(p => p.IdCodigo).ToArray());
        Assert.True(result.DistanciaTotalMeters >= 190.0);
    }

    [Fact]
    public void BuildSequencedRoute_throws_when_quantity_is_not_positive()
    {
        var graph = new RoadNetworkGraph();
        Assert.Throws<ArgumentException>(() =>
            AssignmentService.BuildSequencedRoute(
                new DeparturePointDto(-17.78, -63.18),
                [],
                cantidad: 0,
                graph));
    }

    [Fact]
    public void BuildSequencedRoute_returns_empty_FeatureCollection_when_no_candidates()
    {
        var graph = new RoadNetworkGraph();
        var result = AssignmentService.BuildSequencedRoute(
            new DeparturePointDto(-17.78, -63.18),
            [],
            cantidad: 5,
            graph);

        Assert.Equal(0, result.TotalParadas);
        Assert.Empty(result.Paradas);
        Assert.Equal(0.0, result.DistanciaTotalMeters);
    }
}
