using System.Globalization;

namespace VisorDatosSig.Api;

/// <summary>
/// Custom reports: preview, synchronous generation and the size checks that decide between an immediate download
/// and a background job. File rendering is delegated to the same <see cref="IReportWriter"/>s used by quick exports.
/// </summary>
public sealed class ReportService(IReportDataSource source, IEnumerable<IReportWriter> writers, IConfiguration configuration, TimeProvider clock)
{
    public const int PreviewRows = 50;
    public const int PreviewGroups = 100;
    public int MaxRows => configuration.GetValue("Reports:MaxRows", 50_000);
    /// <summary>Above this many rows the report is generated in the background and the user is notified when it is ready.</summary>
    public int AsyncThreshold => configuration.GetValue("Reports:AsyncThreshold", 5_000);

    public async Task<ReportPreview> PreviewAsync(ReportDefinition definition, CancellationToken cancellationToken)
    {
        var report = ReportDefinitionValidator.Validate(definition);
        var total = await source.CountAsync(report, cancellationToken);
        var rows = new List<string[]>();
        await foreach (var raw in source.ReadRowsAsync(report, PreviewRows, cancellationToken))
            rows.Add(report.Columns.Select((c, i) => PdfReportWriter.FormatValue(c, c.Convert(raw[i]))).ToArray());
        var groups = report.GroupBy is { } group
            ? (await source.GroupCountsAsync(report, PreviewGroups, cancellationToken)).Select(g => new ReportPreviewGroup(ReportGrouping.Label(group.Convert(g.Value)), g.Count)).ToArray()
            : [];
        var columns = report.Columns.Select(c => new ReportPreviewColumn(c.Key, c.Label, c.Kind.ToString().ToLowerInvariant())).ToArray();
        return new(columns, rows, total, report.GroupBy?.Key, groups, MaxRows, AsyncThreshold);
    }

    /// <summary>Counts the rows and rejects reports above the hard limit before any work is queued or rendered.</summary>
    public async Task<long> CheckSizeAsync(ValidatedReport report, CancellationToken cancellationToken)
    {
        var total = await source.CountAsync(report, cancellationToken);
        if (total > MaxRows) throw new ExportTooLargeException(total, MaxRows);
        return total;
    }

    public async Task<ExportFile> GenerateAsync(ValidatedReport report, string generatedBy, CancellationToken cancellationToken)
    {
        var writer = writers.FirstOrDefault(w => w.Format == report.Format) ?? throw new ArgumentException("El formato no está disponible.");
        var total = await CheckSizeAsync(report, cancellationToken);
        var rows = new List<object?[]>((int)Math.Min(total, 10_000));
        await foreach (var raw in source.ReadRowsAsync(report, (int)total, cancellationToken))
        {
            var row = new object?[report.Columns.Count];
            for (var i = 0; i < row.Length; i++) row[i] = report.Columns[i].Convert(raw[i]);
            rows.Add(row);
        }

        var now = ExportService.LocalNow(clock, configuration);
        var document = new ReportDocument(
            Title: report.Title,
            CompanyName: configuration["Reports:CompanyName"] ?? "VisorDatosSIG",
            Columns: report.Columns,
            Rows: rows,
            Parameters: Describe(report, rows.Count, total),
            GeneratedAt: now,
            GeneratedBy: generatedBy,
            Orientation: report.Orientation switch
            {
                "portrait" => ReportOrientation.Portrait,
                "landscape" => ReportOrientation.Landscape,
                _ => report.Columns.Count > ExportService.LandscapeColumnThreshold ? ReportOrientation.Landscape : ReportOrientation.Portrait
            },
            IncludeParametersSheet: report.IncludeParameters,
            GroupColumnIndex: report.GroupBy is { } group ? report.Columns.ToList().IndexOf(group) : null);
        return new ExportFile(writer.Write(document), writer.ContentType, ExportService.FileName(report.Layer.Slug, now, writer.Extension));
    }

    public static IReadOnlyList<ReportParameter> Describe(ValidatedReport report, long exported, long total)
    {
        var parameters = new List<ReportParameter>
        {
            new("Capa", report.Layer.Title),
            new("Búsqueda", report.Q is null ? "Sin búsqueda" : $"\"{report.Q}\"")
        };
        parameters.AddRange(report.Filters.Select(f => new ReportParameter(f.Column.Label, DescribeFilter(f))));
        if (report.GroupBy is { } group) parameters.Add(new("Agrupado por", group.Label));
        if (report.Sort.Count > 0) parameters.Add(new("Orden", string.Join(", ", report.Sort.Select(s => $"{s.Column.Label} {(s.Descending ? "descendente" : "ascendente")}"))));
        parameters.Add(new("Registros exportados", $"{exported.ToString("N0", Culture)} de {total.ToString("N0", Culture)}"));
        return parameters;
    }

    private static readonly CultureInfo Culture = CultureInfo.GetCultureInfo("es-BO");

    private static string DescribeFilter(ValidatedFilter filter)
    {
        string Show(object value) => value switch
        {
            DateOnly date => date.ToString("dd/MM/yyyy", Culture),
            long number when filter.Column.Options is { } options => options.FirstOrDefault(o => o.Value == number.ToString(CultureInfo.InvariantCulture))?.Label ?? number.ToString(Culture),
            IFormattable formattable => formattable.ToString(null, Culture),
            _ => $"\"{value}\""
        };
        return filter.Operator switch
        {
            FilterOperator.Contains => $"contiene {Show(filter.Values[0])}",
            FilterOperator.StartsWith => $"empieza con {Show(filter.Values[0])}",
            FilterOperator.Equals => $"igual a {Show(filter.Values[0])}",
            FilterOperator.In => $"uno de: {string.Join(", ", filter.Values.Select(Show))}",
            FilterOperator.Gte => $"desde {Show(filter.Values[0])}",
            FilterOperator.Lte => $"hasta {Show(filter.Values[0])}",
            _ => $"entre {Show(filter.Values[0])} y {Show(filter.Values[1])}"
        };
    }
}
