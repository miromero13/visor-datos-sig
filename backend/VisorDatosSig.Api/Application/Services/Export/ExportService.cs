namespace VisorDatosSig.Api;

/// <summary>
/// Generic export pipeline: validates the request against the layer allowlist, reads the same rows the search screen shows
/// and hands a <see cref="ReportDocument"/> to the writer of the requested format. New modules only need an
/// <see cref="IExportRowSource"/> and catalog entries; the writers are shared.
/// </summary>
public sealed class ExportService(IExportRowSource source, IEnumerable<IReportWriter> writers, IConfiguration configuration, TimeProvider clock)
{
    public const int MaxTextLength = 200;
    public const int MaxColumns = 30;
    public const int LandscapeColumnThreshold = 6;
    public int MaxRows => configuration.GetValue("Reports:MaxRows", 50_000);

    public async Task<ExportFile> ExportAsync(ExportRequest request, string generatedBy, CancellationToken cancellationToken)
    {
        var layer = request.Layer?.Trim() ?? "";
        if (!source.HasLayer(layer) || !ExportColumnCatalog.TryGetLayer(layer, out var layerTitle, out var slug))
            throw new KeyNotFoundException("The requested layer does not exist.");
        var format = ParseFormat(request.Format);
        var scope = ParseScope(request.Scope);
        var columns = ResolveColumns(layer, request.Columns);
        var filters = ValidateFilters(layer, request.Filters);
        var q = ValidateText(request.Q, "q");
        if (request.SortBy is { Length: > 0 } sortBy && !source.IsApprovedColumn(layer, sortBy)) throw new ArgumentException("sortBy is not an approved field.");
        if (request.SortDirection is { Length: > 0 } dir && dir is not ("asc" or "desc")) throw new ArgumentException("sortDirection must be asc or desc.");
        var page = request.Page ?? 1;
        if (page < 1) throw new ArgumentException("page must be at least 1.");
        var pageSize = Math.Clamp(request.PageSize ?? SearchQueryService.DefaultPageSize, 1, SearchQueryService.MaxPageSize);
        var orientation = ParseOrientation(request.Orientation, columns.Count);
        var writer = writers.FirstOrDefault(w => w.Format == format) ?? throw new ArgumentException("format is not supported.");

        var criteria = new SearchCriteria(layer, q, filters, request.SortBy, request.SortDirection);
        var total = await source.CountAsync(criteria, cancellationToken);
        long offset;
        int take;
        if (scope == ExportScope.All)
        {
            if (total > MaxRows) throw new ExportTooLargeException(total, MaxRows);
            (offset, take) = (0, (int)total);
        }
        else (offset, take) = ((long)(page - 1) * pageSize, pageSize);

        var rows = new List<object?[]>(Math.Min(take, 10_000));
        if (take > 0)
        {
            await foreach (var raw in source.ReadRowsAsync(criteria, columns.Select(c => c.Key).ToArray(), offset, take, cancellationToken))
            {
                var row = new object?[columns.Count];
                for (var i = 0; i < columns.Count; i++) row[i] = columns[i].Convert(raw[i]);
                rows.Add(row);
            }
        }

        var now = LocalNow(clock, configuration);
        var parameters = new List<ReportParameter>
        {
            new("Capa", layerTitle),
            new("Alcance", scope == ExportScope.All ? "Todos los resultados" : $"Página {page} ({pageSize} por página)"),
            new("Búsqueda", string.IsNullOrWhiteSpace(q) ? "Sin búsqueda" : $"\"{q}\"")
        };
        parameters.AddRange(filters.Where(f => !string.IsNullOrWhiteSpace(f.Value))
            .Select(f => new ReportParameter(ExportColumnCatalog.Find(layer, f.Key)?.Label ?? f.Key, ExportColumnCatalog.FilterValueLabel(layer, f.Key, f.Value!))));
        if (request.SortBy is { Length: > 0 } sort)
            parameters.Add(new("Orden", $"{ExportColumnCatalog.Find(layer, sort)?.Label ?? sort} {(request.SortDirection == "desc" ? "descendente" : "ascendente")}"));
        parameters.Add(new("Registros exportados", $"{rows.Count:N0} de {total:N0}"));

        var document = new ReportDocument(
            Title: $"Reporte de {layerTitle.ToLowerInvariant()}",
            CompanyName: configuration["Reports:CompanyName"] ?? "VisorDatosSIG",
            Columns: columns,
            Rows: rows,
            Parameters: parameters,
            GeneratedAt: now,
            GeneratedBy: generatedBy,
            Orientation: orientation,
            IncludeParametersSheet: request.IncludeParameters ?? true);
        return new ExportFile(writer.Write(document), writer.ContentType, FileName(slug, now, writer.Extension));
    }

    public static string FileName(string slug, DateTime localTime, string extension) =>
        $"reporte_{slug}_{localTime:yyyy-MM-dd_HHmm}.{extension}";

    /// <summary>Report timestamps use the configured local time zone (Bolivia by default, UTC-4 without daylight saving).</summary>
    public static DateTime LocalNow(TimeProvider clock, IConfiguration configuration)
    {
        var utc = clock.GetUtcNow();
        var zoneId = configuration["Reports:TimeZone"] ?? "America/La_Paz";
        try { return TimeZoneInfo.ConvertTime(utc, TimeZoneInfo.FindSystemTimeZoneById(zoneId)).DateTime; }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException) { return utc.ToOffset(TimeSpan.FromHours(-4)).DateTime; }
    }

    private List<ExportColumn> ResolveColumns(string layer, string[]? requested)
    {
        if (requested is null || requested.Length == 0) return ExportColumnCatalog.DefaultColumns(layer).ToList();
        if (requested.Length > MaxColumns) throw new ArgumentException($"No se pueden exportar más de {MaxColumns} columnas.");
        var columns = new List<ExportColumn>();
        foreach (var key in requested)
        {
            if (!source.IsApprovedColumn(layer, key)) throw new ArgumentException($"Column '{key}' is not approved for this layer.");
            var column = ExportColumnCatalog.Find(layer, key) ?? new ExportColumn(key, key, ColumnKind.Text);
            if (columns.Any(c => c.Key.Equals(column.Key, StringComparison.OrdinalIgnoreCase))) throw new ArgumentException($"Column '{key}' is repeated.");
            columns.Add(column);
        }
        return columns;
    }

    private Dictionary<string, string?> ValidateFilters(string layer, Dictionary<string, string?>? filters)
    {
        var result = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in filters ?? [])
        {
            if (!source.IsApprovedColumn(layer, key)) throw new ArgumentException($"Filter '{key}' is not approved for this layer.");
            result[key] = ValidateText(value, key);
        }
        return result;
    }

    private static string? ValidateText(string? value, string name)
    {
        if (value is null) return null;
        if (value.Length > MaxTextLength) throw new ArgumentException($"'{name}' cannot exceed {MaxTextLength} characters.");
        if (value.Any(char.IsControl)) throw new ArgumentException($"'{name}' contains invalid characters.");
        return value.Trim();
    }

    private static ExportFormat ParseFormat(string? value) => value?.ToLowerInvariant() switch
    {
        "xlsx" or "excel" => ExportFormat.Xlsx,
        "pdf" => ExportFormat.Pdf,
        _ => throw new ArgumentException("format must be xlsx or pdf.")
    };

    private static ExportScope ParseScope(string? value) => value?.ToLowerInvariant() switch
    {
        null or "" or "page" => ExportScope.Page,
        "all" => ExportScope.All,
        _ => throw new ArgumentException("scope must be page or all.")
    };

    private static ReportOrientation ParseOrientation(string? value, int columnCount) => value?.ToLowerInvariant() switch
    {
        null or "" or "auto" => columnCount > LandscapeColumnThreshold ? ReportOrientation.Landscape : ReportOrientation.Portrait,
        "portrait" => ReportOrientation.Portrait,
        "landscape" => ReportOrientation.Landscape,
        _ => throw new ArgumentException("orientation must be auto, portrait or landscape.")
    };
}
