using System.Globalization;

namespace VisorDatosSig.Api;

/// <summary>
/// Turns an untrusted <see cref="ReportDefinition"/> into a <see cref="ValidatedReport"/>: fields must exist in
/// <see cref="ExportColumnCatalog"/>, operators must fit the column type and values are parsed before reaching SQL.
/// Messages are in Spanish because the report builder shows them to the user.
/// </summary>
public static class ReportDefinitionValidator
{
    public const int MaxColumns = 30;
    public const int MaxFilters = 15;
    public const int MaxSorts = 3;
    public const int MaxListValues = 50;
    public const int MaxTextLength = 200;
    public const int MaxTitleLength = 120;

    public static IReadOnlyList<FilterOperator> OperatorsFor(ColumnKind kind) => kind switch
    {
        ColumnKind.Text => [FilterOperator.Contains, FilterOperator.Equals, FilterOperator.StartsWith, FilterOperator.In],
        ColumnKind.Date => [FilterOperator.Between, FilterOperator.Gte, FilterOperator.Lte],
        _ => [FilterOperator.Equals, FilterOperator.In, FilterOperator.Between, FilterOperator.Gte, FilterOperator.Lte]
    };

    public static string OperatorKey(FilterOperator op) => op switch
    {
        FilterOperator.Contains => "contains",
        FilterOperator.Equals => "equals",
        FilterOperator.StartsWith => "startsWith",
        FilterOperator.In => "in",
        FilterOperator.Gte => "gte",
        FilterOperator.Lte => "lte",
        _ => "between"
    };

    public static ValidatedReport Validate(ReportDefinition definition)
    {
        var layer = ExportColumnCatalog.Layer(definition.Layer?.Trim() ?? "") ?? throw new KeyNotFoundException("La capa solicitada no existe.");
        ExportColumn Field(string? key, string role) =>
            layer.Columns.FirstOrDefault(c => c.Key.Equals(key?.Trim(), StringComparison.OrdinalIgnoreCase))
            ?? throw new ArgumentException($"El campo '{Truncate(key)}' no está permitido como {role} en {layer.Title}.");

        var requested = definition.Columns is { Length: > 0 } ? definition.Columns : ExportColumnCatalog.DefaultColumns(layer.Key).Select(c => c.Key).ToArray();
        if (requested.Length > MaxColumns) throw new ArgumentException($"Elegí como máximo {MaxColumns} columnas.");
        var columns = new List<ExportColumn>();
        foreach (var key in requested)
        {
            var column = Field(key, "columna");
            if (columns.Contains(column)) throw new ArgumentException($"La columna '{column.Label}' está repetida.");
            columns.Add(column);
        }

        var filters = new List<ValidatedFilter>();
        foreach (var filter in definition.Filters ?? [])
        {
            if (filters.Count == MaxFilters) throw new ArgumentException($"Usá como máximo {MaxFilters} filtros.");
            filters.Add(ValidateFilter(Field(filter.Field, "filtro"), filter));
        }

        ExportColumn? groupBy = null;
        if (!string.IsNullOrWhiteSpace(definition.GroupBy))
        {
            groupBy = Field(definition.GroupBy, "agrupación");
            if (!groupBy.Groupable) throw new ArgumentException($"No se puede agrupar por '{groupBy.Label}'.");
            if (!columns.Contains(groupBy)) columns.Insert(0, groupBy);
        }

        var sorts = new List<ValidatedSort>();
        foreach (var sort in definition.Sort ?? [])
        {
            if (string.IsNullOrWhiteSpace(sort.Field)) continue;
            if (sorts.Count == MaxSorts) throw new ArgumentException($"Ordená por {MaxSorts} campos como máximo.");
            var column = Field(sort.Field, "orden");
            if (sorts.Any(s => s.Column == column)) throw new ArgumentException($"El campo '{column.Label}' ya está en el orden.");
            var direction = sort.Direction?.Trim().ToLowerInvariant();
            if (direction is not (null or "" or "asc" or "desc")) throw new ArgumentException("La dirección del orden debe ser ascendente o descendente.");
            sorts.Add(new(column, direction == "desc"));
        }

        var format = definition.Format?.Trim().ToLowerInvariant() switch
        {
            null or "" or "xlsx" or "excel" => ExportFormat.Xlsx,
            "pdf" => ExportFormat.Pdf,
            _ => throw new ArgumentException("El formato debe ser Excel o PDF.")
        };
        var orientation = definition.Orientation?.Trim().ToLowerInvariant();
        if (orientation is not (null or "" or "auto" or "portrait" or "landscape")) throw new ArgumentException("La orientación debe ser automática, vertical u horizontal.");
        var q = CleanText(definition.Q, "búsqueda");
        var title = CleanText(definition.Title, "título");
        if (title?.Length > MaxTitleLength) throw new ArgumentException($"El título no puede superar {MaxTitleLength} caracteres.");
        title = string.IsNullOrWhiteSpace(title) ? $"Reporte de {layer.Title.ToLowerInvariant()}" : title;

        var normalized = new ReportDefinition(
            layer.Key,
            columns.Select(c => c.Key).ToArray(),
            string.IsNullOrEmpty(q) ? null : q,
            filters.Select(f => new ReportFilter(f.Column.Key, OperatorKey(f.Operator),
                f.Operator is FilterOperator.In ? null : FormatValue(f.Values[0]),
                f.Operator is FilterOperator.Between ? FormatValue(f.Values[1]) : null,
                f.Operator is FilterOperator.In ? f.Values.Select(FormatValue).ToArray() : null)).ToArray(),
            groupBy?.Key,
            sorts.Select(s => new ReportSort(s.Column.Key, s.Descending ? "desc" : "asc")).ToArray(),
            format == ExportFormat.Pdf ? "pdf" : "xlsx",
            string.IsNullOrEmpty(orientation) ? "auto" : orientation,
            string.IsNullOrWhiteSpace(definition.Title) ? null : title,
            definition.IncludeParameters ?? true);
        return new(layer, columns, string.IsNullOrEmpty(q) ? null : q, filters, groupBy, sorts, format, normalized.Orientation, title, normalized.IncludeParameters ?? true, normalized);
    }

    private static ValidatedFilter ValidateFilter(ExportColumn column, ReportFilter filter)
    {
        var allowed = OperatorsFor(column.FilterKind);
        var op = allowed.FirstOrDefault(o => OperatorKey(o).Equals(filter.Operator?.Trim(), StringComparison.OrdinalIgnoreCase), (FilterOperator)(-1));
        if ((int)op == -1) throw new ArgumentException($"La condición elegida no se puede usar con '{column.Label}'.");
        object Parse(string? raw) => ParseValue(column, raw);
        IReadOnlyList<object> values = op switch
        {
            FilterOperator.In => (filter.Values ?? []).Where(v => !string.IsNullOrWhiteSpace(v)).Select(Parse).Distinct().ToArray() is { Length: > 0 and <= MaxListValues } list
                ? list
                : throw new ArgumentException($"Indicá entre 1 y {MaxListValues} valores para '{column.Label}'."),
            FilterOperator.Between => [Parse(filter.Value), Parse(filter.ValueTo)],
            _ => [Parse(filter.Value)]
        };
        if (op is FilterOperator.Between && Comparer<object>.Default.Compare(values[0], values[1]) > 0)
            throw new ArgumentException($"En '{column.Label}' el valor inicial no puede ser mayor que el final.");
        return new(column, op, values);
    }

    private static object ParseValue(ExportColumn column, string? raw)
    {
        var text = raw?.Trim();
        if (string.IsNullOrEmpty(text)) throw new ArgumentException($"Completá el valor del filtro '{column.Label}'.");
        switch (column.FilterKind)
        {
            case ColumnKind.Integer:
                if (!long.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var integer)) throw new ArgumentException($"'{column.Label}' necesita un número entero.");
                if (column.Options is { } options && options.All(o => o.Value != integer.ToString(CultureInfo.InvariantCulture))) throw new ArgumentException($"El valor elegido para '{column.Label}' no es válido.");
                return integer;
            case ColumnKind.Decimal or ColumnKind.Coordinate or ColumnKind.Currency:
                if (!decimal.TryParse(text.Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out var number)) throw new ArgumentException($"'{column.Label}' necesita un número.");
                return number;
            case ColumnKind.Date:
                if (!DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)) throw new ArgumentException($"'{column.Label}' necesita una fecha válida.");
                return date;
            default:
                return CleanText(text, column.Label)!;
        }
    }

    private static string? CleanText(string? value, string name)
    {
        if (value is null) return null;
        if (value.Length > MaxTextLength) throw new ArgumentException($"'{name}' no puede superar {MaxTextLength} caracteres.");
        if (value.Any(char.IsControl)) throw new ArgumentException($"'{name}' contiene caracteres no válidos.");
        return value.Trim();
    }

    private static string FormatValue(object value) => value switch
    {
        DateOnly date => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString() ?? ""
    };

    private static string Truncate(string? value) => value is null ? "" : value.Length > 40 ? value[..40] + "…" : value;
}
