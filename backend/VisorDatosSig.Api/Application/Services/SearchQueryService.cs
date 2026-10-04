using System.Data;
using Microsoft.Data.SqlClient;
using NetTopologySuite.IO;

namespace VisorDatosSig.Api;

public sealed class SearchQueryService(IConfiguration configuration)
{
    public const int DefaultPageSize = 25;
    public const int MaxPageSize = 100;
    private static readonly IReadOnlyDictionary<string, Definition> Layers = new Dictionary<string, Definition>(StringComparer.OrdinalIgnoreCase)
    {
        ["CodigosFijos"] = new("CodigosFijos", "IdCodigo", ["IdCodigo", "CodF_SQL", "CodF_SIG", "CodFijo", "Nombre", "Estado", "IdLote", "Longitud", "Latitud"], ["CodF_SQL", "CodF_SIG", "CodFijo", "Nombre"]),
        ["Lotes"] = new("Lotes", "IdLote", ["IdLote", "IdOrigen", "NroLote", "IdManzana"], ["NroLote"]),
        ["Manzanas"] = new("Manzanas", "IdManzana", ["IdManzana", "IdOrigen", "UV_MZA", "UV", "MZA"], ["UV", "MZA"]),
        ["Vias"] = new("Vias", "IdVia", ["IdVia", "OBJECTID", "Nombre", "TipoVia", "OSMID"], ["Nombre", "TipoVia", "OSMID"])
    };

    public async Task<object> SearchAsync(string layerName, string? q, int page, int? pageSize, string? sortBy, string? sortDirection, IReadOnlyDictionary<string, string?> filters, CancellationToken cancellationToken)
    {
        if (!Layers.TryGetValue(layerName, out var layer)) throw new KeyNotFoundException("The requested layer does not exist.");
        if (page < 1) throw new ArgumentException("page must be at least 1.");
        var size = Math.Clamp(pageSize ?? DefaultPageSize, 1, MaxPageSize);
        var sort = string.IsNullOrWhiteSpace(sortBy) ? layer.Id : layer.Attributes.FirstOrDefault(x => x.Equals(sortBy, StringComparison.OrdinalIgnoreCase)) ?? throw new ArgumentException("sortBy is not an approved field.");
        var direction = string.IsNullOrWhiteSpace(sortDirection) || sortDirection.Equals("asc", StringComparison.OrdinalIgnoreCase) ? "ASC" : sortDirection.Equals("desc", StringComparison.OrdinalIgnoreCase) ? "DESC" : throw new ArgumentException("sortDirection must be asc or desc.");
        var clauses = new List<string> { "Geom IS NOT NULL" };
        var parameters = new List<SqlParameter>();
        if (!string.IsNullOrWhiteSpace(q))
        {
            clauses.Add("(" + string.Join(" OR ", layer.SearchFields.Select((field, i) => $"TRY_CONVERT(nvarchar(4000),[{field}]) LIKE @q{i}")) + ")");
            foreach (var (field, i) in layer.SearchFields.Select((x, i) => (x, i))) parameters.Add(new SqlParameter($"@q{i}", SqlDbType.NVarChar, 4000) { Value = $"%{q.Trim()}%" });
        }
        foreach (var (key, value) in filters)
        {
            if (string.IsNullOrWhiteSpace(value)) continue;
            var field = layer.Attributes.FirstOrDefault(x => x.Equals(key, StringComparison.OrdinalIgnoreCase));
            if (field is null) throw new ArgumentException($"Filter '{key}' is not approved for this layer.");
            var parameterName = "@f" + parameters.Count;
            var exactMatch = field.Equals("Estado", StringComparison.OrdinalIgnoreCase) || field.Equals("TipoVia", StringComparison.OrdinalIgnoreCase);
            clauses.Add(exactMatch
                ? $"TRY_CONVERT(nvarchar(4000),[{field}]) = {parameterName}"
                : $"TRY_CONVERT(nvarchar(4000),[{field}]) LIKE {parameterName}");
            parameters.Add(new SqlParameter(parameterName, SqlDbType.NVarChar, 4000) { Value = exactMatch ? value.Trim() : $"%{value.Trim()}%" });
        }
        var where = string.Join(" AND ", clauses);
        var select = string.Join(",", layer.Attributes.Select(x => $"[{x}]"));
        var tieBreaker = sort.Equals(layer.Id, StringComparison.OrdinalIgnoreCase) ? "" : $", [{layer.Id}] ASC";
        var sql = $"SELECT COUNT_BIG(*) FROM dbo.[{layer.Table}] WHERE {where}; SELECT {select}, Geom.STAsText() AS Wkt FROM dbo.[{layer.Table}] WHERE {where} ORDER BY [{sort}] {direction}{tieBreaker} OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY";
        var items = new List<object>();
        long total;
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        foreach (var parameter in parameters) command.Parameters.Add(parameter);
        command.Parameters.Add("@offset", SqlDbType.BigInt).Value = (long)(page - 1) * size;
        command.Parameters.Add("@size", SqlDbType.Int).Value = size;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        total = await reader.ReadAsync(cancellationToken) ? reader.GetInt64(0) : 0;
        await reader.NextResultAsync(cancellationToken);
        var wkt = new WKTReader();
        while (await reader.ReadAsync(cancellationToken))
        {
            var properties = new Dictionary<string, object?>();
            for (var i = 0; i < layer.Attributes.Length; i++) properties[layer.Attributes[i]] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            var geometry = reader.IsDBNull(layer.Attributes.Length) ? null : ToGeoJson(wkt.Read(reader.GetString(layer.Attributes.Length)));
            items.Add(new { id = properties.GetValueOrDefault(layer.Id), properties, geometry, type = "Feature" });
        }
        return new { data = new { items, page, pageSize = size, total }, meta = new { layer = layer.Name } };
    }

    private static object ToGeoJson(NetTopologySuite.Geometries.Geometry geometry)
    {
        object Coordinates(NetTopologySuite.Geometries.Coordinate c) => new[] { c.X, c.Y };
        object Ring(NetTopologySuite.Geometries.Coordinate[] cs) => cs.Select(Coordinates).ToArray();
        object coordinates = geometry switch
        {
            NetTopologySuite.Geometries.Point p => Coordinates(p.Coordinate),
            NetTopologySuite.Geometries.MultiPoint mp => mp.Geometries.Cast<NetTopologySuite.Geometries.Point>().Select(p => Coordinates(p.Coordinate)).ToArray(),
            NetTopologySuite.Geometries.LineString ls => ls.Coordinates.Select(Coordinates).ToArray(),
            NetTopologySuite.Geometries.MultiLineString mls => mls.Geometries.Cast<NetTopologySuite.Geometries.LineString>().Select(l => l.Coordinates.Select(Coordinates).ToArray()).ToArray(),
            NetTopologySuite.Geometries.Polygon p => new object[] { Ring(p.ExteriorRing.Coordinates) }.Concat(Enumerable.Range(0, p.NumInteriorRings).Select(i => Ring(p.GetInteriorRingN(i).Coordinates))).ToArray(),
            NetTopologySuite.Geometries.MultiPolygon mp => mp.Geometries.Cast<NetTopologySuite.Geometries.Polygon>().Select(p => (object)new object[] { Ring(p.ExteriorRing.Coordinates) }.Concat(Enumerable.Range(0, p.NumInteriorRings).Select(i => Ring(p.GetInteriorRingN(i).Coordinates))).ToArray()).ToArray(),
            _ => throw new InvalidDataException("Unsupported layer geometry type.")
        };
        var type = geometry switch { NetTopologySuite.Geometries.Point => "Point", NetTopologySuite.Geometries.MultiPoint => "MultiPoint", NetTopologySuite.Geometries.LineString => "LineString", NetTopologySuite.Geometries.MultiLineString => "MultiLineString", NetTopologySuite.Geometries.Polygon => "Polygon", NetTopologySuite.Geometries.MultiPolygon => "MultiPolygon", _ => throw new InvalidDataException("Unsupported layer geometry type.") };
        return new { type, coordinates };
    }
    public async Task<IReadOnlyList<string>> GetViaTypesAsync(CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = new SqlCommand("SELECT DISTINCT TRY_CONVERT(nvarchar(200), [TipoVia]) FROM dbo.[Vias] WHERE [TipoVia] IS NOT NULL AND LTRIM(RTRIM(TRY_CONVERT(nvarchar(200), [TipoVia]))) <> '' ORDER BY TRY_CONVERT(nvarchar(200), [TipoVia])", connection);
        var values = new List<string>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) values.Add(reader.GetString(0));
        return values;
    }

    private async Task<SqlConnection> OpenAsync(CancellationToken token)
    {
        var cs = configuration.GetConnectionString("MigrationDb");
        if (string.IsNullOrWhiteSpace(cs)) throw new InvalidOperationException("Layer database connection is not configured.");
        var connection = new SqlConnection(cs);
        await connection.OpenAsync(token);
        return connection;
    }
    private sealed record Definition(string Name, string Id, string[] Attributes, string[] SearchFields) { public string Table => Name; }
}
