namespace VisorDatosSig.Api;

/// <summary>Labels, data types and file-name slugs for each exportable layer. Keys must match the search allowlist.</summary>
public static class ExportColumnCatalog
{
    private static readonly IReadOnlyDictionary<int, string> FixedCodeStates = new Dictionary<int, string>
    {
        [1] = "Normal", [2] = "Para corte", [3] = "Cortado", [4] = "Baja parcial", [5] = "Baja total"
    };

    private static object? StateLabel(object? raw)
    {
        if (raw is null) return null;
        var code = System.Convert.ToInt32(raw);
        return FixedCodeStates.TryGetValue(code, out var label) ? label : code.ToString();
    }

    private static readonly IReadOnlyList<FieldOption> StateOptions = FixedCodeStates.Select(s => new FieldOption(s.Key.ToString(), s.Value)).ToArray();

    /// <summary>Table and identifier are fixed per layer and never come from the request.</summary>
    public sealed record LayerInfo(string Key, string Title, string Slug, string Table, string IdColumn, IReadOnlyList<ExportColumn> Columns, IReadOnlyList<string> SearchFields);

    private static readonly IReadOnlyDictionary<string, LayerInfo> Layers = new Dictionary<string, LayerInfo>(StringComparer.OrdinalIgnoreCase)
    {
        ["CodigosFijos"] = new("CodigosFijos", "Códigos fijos", "codigos_fijos", "CodigosFijos", "IdCodigo",
        [
            new("IdCodigo", "ID", ColumnKind.Integer),
            new("CodF_SQL", "Código SQL", ColumnKind.Integer),
            new("CodF_SIG", "Código SIG", ColumnKind.Text),
            new("CodFijo", "Código fijo", ColumnKind.Integer),
            new("Nombre", "Nombre", ColumnKind.Text),
            new("Estado", "Estado", ColumnKind.Text, Map: StateLabel, FilterAs: ColumnKind.Integer, Options: StateOptions),
            new("FechaCambioEstado", "Fecha de cambio de estado", ColumnKind.Date, ReportOnly: true),
            new("IdLote", "Lote (ID)", ColumnKind.Integer),
            new("Longitud", "Longitud", ColumnKind.Coordinate),
            new("Latitud", "Latitud", ColumnKind.Coordinate)
        ], ["CodF_SQL", "CodF_SIG", "CodFijo", "Nombre"]),
        ["Lotes"] = new("Lotes", "Lotes", "lotes", "Lotes", "IdLote",
        [
            new("IdLote", "ID", ColumnKind.Integer),
            new("IdOrigen", "ID origen", ColumnKind.Integer),
            new("NroLote", "Nro. de lote", ColumnKind.Text),
            new("IdManzana", "Manzana (ID)", ColumnKind.Integer)
        ], ["NroLote"]),
        ["Manzanas"] = new("Manzanas", "Manzanas", "manzanas", "Manzanas", "IdManzana",
        [
            new("IdManzana", "ID", ColumnKind.Integer),
            new("IdOrigen", "ID origen", ColumnKind.Integer),
            new("UV_MZA", "UV-MZA", ColumnKind.Text),
            new("UV", "UV", ColumnKind.Text),
            new("MZA", "Manzana", ColumnKind.Text)
        ], ["UV", "MZA"]),
        ["Vias"] = new("Vias", "Vías", "vias", "Vias", "IdVia",
        [
            new("IdVia", "ID", ColumnKind.Integer),
            new("OBJECTID", "Object ID", ColumnKind.Integer),
            new("Nombre", "Nombre", ColumnKind.Text),
            new("TipoVia", "Tipo de vía", ColumnKind.Text),
            new("OSMID", "OSM ID", ColumnKind.Text)
        ], ["Nombre", "TipoVia", "OSMID"])
    };

    public static bool TryGetLayer(string layer, out string title, out string slug)
    {
        var found = Layers.TryGetValue(layer, out var info);
        title = info?.Title ?? "";
        slug = info?.Slug ?? "";
        return found;
    }

    public static ExportColumn? Find(string layer, string key) =>
        Layers.TryGetValue(layer, out var info) ? info.Columns.FirstOrDefault(c => c.Key.Equals(key, StringComparison.OrdinalIgnoreCase)) : null;

    public static IReadOnlyList<ExportColumn> DefaultColumns(string layer) =>
        Layers.TryGetValue(layer, out var info) ? info.Columns.Where(c => !c.ReportOnly).ToList() : [];

    public static LayerInfo? Layer(string layer) => Layers.TryGetValue(layer, out var info) ? info : null;

    public static IEnumerable<LayerInfo> AllLayers => Layers.Values;

    public static string FilterValueLabel(string layer, string key, string value)
    {
        var column = Find(layer, key);
        if (column?.Map is null || !int.TryParse(value, out var number)) return value;
        return $"{column.Convert(number)} ({value})";
    }
}
