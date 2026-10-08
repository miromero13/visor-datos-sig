namespace VisorDatosSig.Api;

/// <summary>Export request: mirrors the state of the query screen (layer, search, filters, sort, visible columns and page).</summary>
public sealed record ExportRequest(
    string? Layer,
    string? Format,
    string? Scope,
    string? Q,
    Dictionary<string, string?>? Filters,
    string? SortBy,
    string? SortDirection,
    string[]? Columns,
    int? Page,
    int? PageSize,
    string? Orientation,
    bool? IncludeParameters);

public enum ExportFormat { Xlsx, Pdf }
public enum ExportScope { Page, All }
public enum ReportOrientation { Portrait, Landscape }
public enum ColumnKind { Text, Integer, Decimal, Coordinate, Currency, Date }

public sealed record FieldOption(string Value, string Label);

/// <summary>
/// Display metadata for an approved column. <see cref="Convert"/> turns the raw SQL value into the value written to the file.
/// <see cref="FilterKind"/> is the stored type used to filter (Estado is stored as a number but shown as a label);
/// <see cref="ReportOnly"/> columns are available in custom reports but not on the search screen.
/// </summary>
public sealed record ExportColumn(string Key, string Label, ColumnKind Kind, bool Summable = false, Func<object?, object?>? Map = null,
    ColumnKind? FilterAs = null, IReadOnlyList<FieldOption>? Options = null, bool ReportOnly = false)
{
    public object? Convert(object? raw) => raw is null ? null : Map is null ? raw : Map(raw);
    public ColumnKind FilterKind => FilterAs ?? Kind;
    public bool Groupable => Kind is ColumnKind.Text or ColumnKind.Integer;
}

public sealed record ReportParameter(string Name, string Value);

/// <summary>Everything a writer needs; writers never touch the database or the HTTP request.</summary>
public sealed record ReportDocument(
    string Title,
    string CompanyName,
    IReadOnlyList<ExportColumn> Columns,
    IReadOnlyList<object?[]> Rows,
    IReadOnlyList<ReportParameter> Parameters,
    DateTime GeneratedAt,
    string GeneratedBy,
    ReportOrientation Orientation,
    bool IncludeParametersSheet,
    int? GroupColumnIndex = null);

public sealed record ExportFile(byte[] Content, string ContentType, string FileName);

public interface IReportWriter
{
    ExportFormat Format { get; }
    string ContentType { get; }
    string Extension { get; }
    byte[] Write(ReportDocument document);
}

/// <summary>Data access the export service depends on; implemented by <see cref="SearchQueryService"/> so exports filter exactly like the search screen.</summary>
public interface IExportRowSource
{
    bool HasLayer(string layer);
    bool IsApprovedColumn(string layer, string column);
    Task<long> CountAsync(SearchCriteria criteria, CancellationToken cancellationToken);
    IAsyncEnumerable<object?[]> ReadRowsAsync(SearchCriteria criteria, IReadOnlyList<string> columns, long offset, int take, CancellationToken cancellationToken);
}

public sealed class ExportTooLargeException(long total, int max)
    : Exception($"La consulta tiene {total:N0} registros y el máximo exportable es {max:N0}. Aplicá más filtros para reducir los resultados.")
{
    public long Total { get; } = total;
    public int Max { get; } = max;
}
