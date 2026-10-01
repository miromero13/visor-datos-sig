using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace VisorDatosSig.Api;

public sealed class LayerQueryService(IConfiguration configuration)
{
    public const int MaxFeatures = 1000;
    private static readonly IReadOnlyDictionary<string, LayerDefinition> Layers = new Dictionary<string, LayerDefinition>(StringComparer.OrdinalIgnoreCase)
    {
        ["CodigosFijos"] = new("CodigosFijos", "IdCodigo", ["CodF_SQL", "CodF_SIG", "CodFijo", "Nombre", "Estado", "IdLote", "Longitud", "Latitud"]),
        ["Lotes"] = new("Lotes", "IdLote", ["IdOrigen", "NroLote", "IdManzana"]),
        ["Manzanas"] = new("Manzanas", "IdManzana", ["IdOrigen", "UV_MZA", "UV", "MZA"]),
        ["Vias"] = new("Vias", "IdVia", ["OBJECTID", "Nombre", "TipoVia", "OSMID"])
    };

    public object Catalog() => new { layers = Layers.Values.Select(x => new { id = x.Name, label = x.Name switch { "CodigosFijos" => "Códigos fijos", "Lotes" => "Lotes", "Manzanas" => "Manzanas", _ => "Vías" }, geometryType = x.Name == "CodigosFijos" ? "Point" : x.Name == "Vias" ? "LineString" : "Polygon", srid = 4326 }) };

    public async Task<object> GeoJsonAsync(string name, string? bbox, int? limit, CancellationToken cancellationToken)
    {
        var layer = Find(name);
        var max = Math.Clamp(limit ?? 1000, 1, MaxFeatures);
        var bounds = ParseBbox(bbox);
        var where = bounds is null ? "" : " WHERE Geom.STIntersects(geometry::STGeomFromText(@bbox,4326))=1";
        var sql = $"SELECT TOP (@limit) {string.Join(",", layer.Attributes.Select(x => $"[{x}]"))}, Geom.STAsText() AS Wkt FROM dbo.[{layer.Table}]{where} AND Geom IS NOT NULL";
        if (bounds is null) sql = $"SELECT TOP (@limit) {string.Join(",", layer.Attributes.Select(x => $"[{x}]"))}, Geom.STAsText() AS Wkt FROM dbo.[{layer.Table}] WHERE Geom IS NOT NULL";
        var features = new List<object>();
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@limit", SqlDbType.Int).Value = max;
        if (bounds is not null) command.Parameters.Add("@bbox", SqlDbType.NVarChar, 200).Value = bounds;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var wktReader = new WKTReader();
        while (await reader.ReadAsync(cancellationToken))
        {
            if (reader.IsDBNull(layer.Attributes.Length)) continue;
            var properties = new Dictionary<string, object?>();
            for (var i = 0; i < layer.Attributes.Length; i++) properties[layer.Attributes[i]] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            var geometry = wktReader.Read(reader.GetString(layer.Attributes.Length));
            features.Add(new { type = "Feature", id = properties.GetValueOrDefault(layer.Id), geometry = ToGeoJson(geometry), properties });
        }
        return new { type = "FeatureCollection", features, numberReturned = features.Count, limit = max, srid = 4326 };
    }

    public async Task<object?> DetailAsync(string name, int id, CancellationToken cancellationToken)
    {
        var layer = Find(name);
        var sql = $"SELECT {string.Join(",", layer.Attributes.Select(x => $"[{x}]"))}, Geom.STAsText() AS Wkt FROM dbo.[{layer.Table}] WHERE [{layer.Id}]=@id";
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@id", SqlDbType.Int).Value = id;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) return null;
        var properties = layer.Attributes.Select((x, i) => (x, Value: reader.IsDBNull(i) ? null : reader.GetValue(i))).ToDictionary(x => x.x, x => x.Value);
        var geometry = reader.IsDBNull(layer.Attributes.Length) ? null : ToGeoJson(new WKTReader().Read(reader.GetString(layer.Attributes.Length)));
        return new { type = "Feature", id, geometry, properties };
    }

    public async Task<object?> ExtentAsync(string name, CancellationToken cancellationToken)
    {
        var layer = Find(name);
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new SqlCommand($"SELECT Geom.STEnvelope().STAsText() FROM dbo.[{layer.Table}] WHERE Geom IS NOT NULL", connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        Envelope? envelope = null;
        var parser = new WKTReader();
        while (await reader.ReadAsync(cancellationToken))
        {
            if (reader.IsDBNull(0)) continue;
            var current = parser.Read(reader.GetString(0)).EnvelopeInternal;
            if (envelope is null) envelope = new Envelope(current);
            else envelope.ExpandToInclude(current);
        }
        return envelope is null || envelope.IsNull ? null : new { west = envelope.MinX, south = envelope.MinY, east = envelope.MaxX, north = envelope.MaxY, srid = 4326 };
    }

    private static object ToGeoJson(Geometry g)
    {
        object Coordinates(Coordinate c) => new[] { c.X, c.Y };
        object Ring(Coordinate[] cs) => cs.Select(Coordinates).ToArray();
        object result = g switch
        {
            Point p => Coordinates(p.Coordinate),
            MultiPoint mp => mp.Geometries.Cast<Point>().Select(p => Coordinates(p.Coordinate)).ToArray(),
            LineString ls => ls.Coordinates.Select(Coordinates).ToArray(),
            MultiLineString mls => mls.Geometries.Cast<LineString>().Select(l => l.Coordinates.Select(Coordinates).ToArray()).ToArray(),
            Polygon p => new object[] { Ring(p.ExteriorRing.Coordinates) }.Concat(Enumerable.Range(0, p.NumInteriorRings).Select(i => Ring(p.GetInteriorRingN(i).Coordinates))).ToArray(),
            MultiPolygon mp => mp.Geometries.Cast<Polygon>().Select(p => (object)new object[] { Ring(p.ExteriorRing.Coordinates) }.Concat(Enumerable.Range(0, p.NumInteriorRings).Select(i => Ring(p.GetInteriorRingN(i).Coordinates))).ToArray()).ToArray(),
            _ => throw new InvalidDataException("Unsupported layer geometry type.")
        };
        var type = g switch { Point => "Point", MultiPoint => "MultiPoint", LineString => "LineString", MultiLineString => "MultiLineString", Polygon => "Polygon", MultiPolygon => "MultiPolygon", _ => throw new InvalidDataException("Unsupported layer geometry type.") };
        return new { type, coordinates = result };
    }

    private static string? ParseBbox(string? bbox)
    {
        if (string.IsNullOrWhiteSpace(bbox)) return null;
        var values = bbox.Split(',');
        if (values.Length != 4 || !values.All(x => double.TryParse(x, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var n) && double.IsFinite(n))) throw new ArgumentException("bbox must contain west,south,east,north coordinates.");
        var v = values.Select(x => double.Parse(x, System.Globalization.CultureInfo.InvariantCulture)).ToArray();
        if (v[0] < -180 || v[2] > 180 || v[1] < -90 || v[3] > 90 || v[0] >= v[2] || v[1] >= v[3]) throw new ArgumentException("bbox is outside valid longitude/latitude bounds.");
        return $"POLYGON(({v[0].ToString(System.Globalization.CultureInfo.InvariantCulture)} {v[1].ToString(System.Globalization.CultureInfo.InvariantCulture)},{v[2].ToString(System.Globalization.CultureInfo.InvariantCulture)} {v[1].ToString(System.Globalization.CultureInfo.InvariantCulture)},{v[2].ToString(System.Globalization.CultureInfo.InvariantCulture)} {v[3].ToString(System.Globalization.CultureInfo.InvariantCulture)},{v[0].ToString(System.Globalization.CultureInfo.InvariantCulture)} {v[3].ToString(System.Globalization.CultureInfo.InvariantCulture)},{v[0].ToString(System.Globalization.CultureInfo.InvariantCulture)} {v[1].ToString(System.Globalization.CultureInfo.InvariantCulture)}))";
    }
    private static LayerDefinition Find(string name) => Layers.TryGetValue(name, out var value) ? value : throw new KeyNotFoundException("The requested layer does not exist.");
    private async Task<SqlConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var cs = configuration.GetConnectionString("MigrationDb");
        if (string.IsNullOrWhiteSpace(cs)) throw new InvalidOperationException("Layer database connection is not configured.");
        var connection = new SqlConnection(cs);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }
    private sealed record LayerDefinition(string Name, string Id, string[] Attributes) { public string Table => Name; }
}
