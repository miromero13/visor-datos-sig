using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace VisorDatosSig.Api;

public sealed class LayerQueryService(IConfiguration configuration)
{
    public const int MaxFeatures = 5000;
    public const int DefaultFeatures = 1000;
    private static readonly IReadOnlyDictionary<string, LayerDefinition> Layers = new Dictionary<string, LayerDefinition>(StringComparer.OrdinalIgnoreCase)
    {
        ["CodigosFijos"] = new("CodigosFijos", "IdCodigo", ["CodF_SQL", "CodF_SIG", "CodFijo", "Nombre", "Estado", "IdLote", "Longitud", "Latitud"]),
        ["Lotes"] = new("Lotes", "IdLote", ["IdOrigen", "NroLote", "IdManzana"]),
        ["Manzanas"] = new("Manzanas", "IdManzana", ["IdOrigen", "UV_MZA", "UV", "MZA"]),
        ["Vias"] = new("Vias", "IdVia", ["OBJECTID", "Nombre", "TipoVia", "OSMID"])
    };

    public object Catalog() => new { layers = Layers.Values.Select(x => new { id = x.Name, label = x.Name switch { "CodigosFijos" => "Códigos fijos", "Lotes" => "Lotes", "Manzanas" => "Manzanas", _ => "Vías" }, geometryType = x.Name == "CodigosFijos" ? "Point" : x.Name == "Vias" ? "LineString" : "Polygon", srid = 4326 }) };

    public async Task<object> GeoJsonAsync(string name, string? bbox, int? limit, CancellationToken cancellationToken, int? estado = null, string? nombre = null, int? afterId = null, bool minimal = false)
    {
        var layer = Find(name);
        if ((estado is not null || !string.IsNullOrWhiteSpace(nombre)) && layer.Name != "CodigosFijos") throw new ArgumentException("Estado and Nombre filters are only available for CodigosFijos.");
        if (estado is not null && estado is < 1 or > 5) throw new ArgumentException("Estado must be between 1 and 5.");
        if (afterId is not null && layer.Name != "CodigosFijos") throw new ArgumentException("Cursor pagination is only available for CodigosFijos.");
        if (afterId is < 0) throw new ArgumentException("afterId must be nonnegative.");
        var max = Math.Clamp(limit ?? DefaultFeatures, 1, MaxFeatures);
        var bounds = ParseBbox(bbox);
        var predicates = new List<string> { "Geom IS NOT NULL" };
        if (bounds is not null) predicates.Add("Geom.STIntersects(geometry::STGeomFromText(@bbox,4326))=1");
        if (estado is not null) predicates.Add("[Estado]=@estado");
        if (!string.IsNullOrWhiteSpace(nombre))
        {
            if (int.TryParse(nombre.Trim(), out var codFijoVal))
            {
                predicates.Add("(CHARINDEX(@nombre,[Nombre])>0 OR [CodFijo]=@codFijo OR [CodF_SQL]=@codFijo)");
            }
            else
            {
                predicates.Add("(CHARINDEX(@nombre,[Nombre])>0 OR CHARINDEX(@nombre,[CodF_SIG])>0)");
            }
        }
        if (afterId is not null) predicates.Add("[IdCodigo]>@afterId");
        var attributes = ProjectAttributes(layer, minimal);
        var sql = $"SELECT TOP (@limit) {string.Join(",", attributes.Select(x => $"[{x}]"))}, Geom.STAsText() AS Wkt FROM dbo.[{layer.Table}] WHERE {string.Join(" AND ", predicates)} ORDER BY [{layer.Id}]";
        var features = new List<object>();
        var featureIds = new List<int>();
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@limit", SqlDbType.Int).Value = afterId is null ? max : max + 1;
        if (afterId is not null) command.Parameters.Add("@afterId", SqlDbType.Int).Value = afterId.Value;
        if (bounds is not null) command.Parameters.Add("@bbox", SqlDbType.NVarChar, 200).Value = bounds;
        if (estado is not null) command.Parameters.Add("@estado", SqlDbType.Int).Value = estado.Value;
        if (!string.IsNullOrWhiteSpace(nombre))
        {
            command.Parameters.Add("@nombre", SqlDbType.NVarChar, 200).Value = nombre.Trim();
            if (int.TryParse(nombre.Trim(), out var codFijoVal))
            {
                command.Parameters.Add("@codFijo", SqlDbType.Int).Value = codFijoVal;
            }
        }
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var wktReader = new WKTReader();
        while (await reader.ReadAsync(cancellationToken))
        {
            if (reader.IsDBNull(attributes.Length)) continue;
            var properties = new Dictionary<string, object?>();
            for (var i = 0; i < attributes.Length; i++) properties[attributes[i]] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            var geometry = wktReader.Read(reader.GetString(attributes.Length));
            var featureId = Convert.ToInt32(properties.GetValueOrDefault(layer.Id));
            features.Add(new { type = "Feature", id = featureId, geometry = ToGeoJson(geometry), properties });
            featureIds.Add(featureId);
        }
        if (afterId is null) return new { type = "FeatureCollection", features, numberReturned = features.Count, limit = max, srid = 4326 };
        var hasMore = features.Count > max;
        if (hasMore) { features.RemoveAt(features.Count - 1); featureIds.RemoveAt(featureIds.Count - 1); }
        var nextAfterId = featureIds.Count > 0 ? featureIds[^1] : (int?)null;
        return new { type = "FeatureCollection", features, numberReturned = features.Count, limit = max, srid = 4326, hasMore, nextAfterId };
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

    public async Task<object> DashboardSummaryAsync(CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        const string sql = @"
            SELECT 
                (SELECT COUNT_BIG(*) FROM dbo.[Manzanas]) AS TotalManzanas,
                (SELECT COUNT_BIG(*) FROM dbo.[Lotes]) AS TotalLotes,
                (SELECT COUNT_BIG(*) FROM dbo.[CodigosFijos]) AS TotalCodigosFijos,
                (SELECT COUNT_BIG(*) FROM dbo.[Vias]) AS TotalVias,
                (SELECT COUNT_BIG(*) FROM dbo.[Usuarios] WHERE Activo = 1) AS TotalOperadoresActivos;

            SELECT ISNULL(Estado, 0) AS Estado, COUNT_BIG(*) AS Cantidad
            FROM dbo.[CodigosFijos]
            GROUP BY Estado;";

        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        long manzanas = 0, lotes = 0, codigosFijos = 0, vias = 0, operadoresActivos = 0;
        if (await reader.ReadAsync(cancellationToken))
        {
            manzanas = reader.IsDBNull(0) ? 0 : reader.GetInt64(0);
            lotes = reader.IsDBNull(1) ? 0 : reader.GetInt64(1);
            codigosFijos = reader.IsDBNull(2) ? 0 : reader.GetInt64(2);
            vias = reader.IsDBNull(3) ? 0 : reader.GetInt64(3);
            operadoresActivos = reader.IsDBNull(4) ? 0 : reader.GetInt64(4);
        }

        var estados = new Dictionary<int, long>();
        if (await reader.NextResultAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
            {
                var estadoVal = Convert.ToInt32(reader.GetValue(0));
                var cant = reader.GetInt64(1);
                estados[estadoVal] = cant;
            }
        }

        var totalEntidades = manzanas + lotes + codigosFijos + vias;

        return new
        {
            data = new
            {
                totales = new
                {
                    manzanas,
                    lotes,
                    codigosFijos,
                    vias,
                    totalEntidades,
                    operadoresActivos
                },
                estados = new[]
                {
                    new { valor = 1, label = "Normal", cantidad = estados.GetValueOrDefault(1, 0), color = "#16a34a" },
                    new { valor = 2, label = "Para corte", cantidad = estados.GetValueOrDefault(2, 0), color = "#f97316" },
                    new { valor = 3, label = "Cortado", cantidad = estados.GetValueOrDefault(3, 0), color = "#dc2626" },
                    new { valor = 4, label = "Baja parcial", cantidad = estados.GetValueOrDefault(4, 0), color = "#8b5cf6" },
                    new { valor = 5, label = "Baja total", cantidad = estados.GetValueOrDefault(5, 0), color = "#6b7280" }
                }
            }
        };
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
    public static string[] ProjectAttributesForTests(string name, bool minimal) => ProjectAttributes(Find(name), minimal);
    private static string[] ProjectAttributes(LayerDefinition layer, bool minimal) => minimal
        ? (layer.Name == "CodigosFijos" ? new[] { "CodF_SQL", "CodF_SIG", "CodFijo", "Nombre", "Estado", "IdCodigo" } : new[] { layer.Id })
        : layer.Name == "CodigosFijos" ? layer.Attributes.Append("IdCodigo").Distinct(StringComparer.OrdinalIgnoreCase).ToArray() : layer.Attributes;
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
