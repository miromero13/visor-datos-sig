namespace VisorDatosSig.Api;

/// <summary>Custom report as sent by the report builder or stored in a template. Every value is untrusted until validated.</summary>
public sealed record ReportDefinition(
    string? Layer,
    string[]? Columns,
    string? Q,
    ReportFilter[]? Filters,
    string? GroupBy,
    ReportSort[]? Sort,
    string? Format,
    string? Orientation,
    string? Title,
    bool? IncludeParameters);

public sealed record ReportFilter(string? Field, string? Operator, string? Value, string? ValueTo, string[]? Values);
public sealed record ReportSort(string? Field, string? Direction);

public enum FilterOperator { Contains, Equals, StartsWith, In, Gte, Lte, Between }

/// <summary>A filter whose field comes from the catalog and whose values are already parsed to the column type.</summary>
public sealed record ValidatedFilter(ExportColumn Column, FilterOperator Operator, IReadOnlyList<object> Values);
public sealed record ValidatedSort(ExportColumn Column, bool Descending);

public sealed record ValidatedReport(
    ExportColumnCatalog.LayerInfo Layer,
    IReadOnlyList<ExportColumn> Columns,
    string? Q,
    IReadOnlyList<ValidatedFilter> Filters,
    ExportColumn? GroupBy,
    IReadOnlyList<ValidatedSort> Sort,
    ExportFormat Format,
    string? Orientation,
    string Title,
    bool IncludeParameters,
    ReportDefinition Normalized);

/// <summary>Database access for custom reports; the SQL implementation builds parameterized queries from a <see cref="ValidatedReport"/>.</summary>
public interface IReportDataSource
{
    Task<long> CountAsync(ValidatedReport report, CancellationToken cancellationToken);
    IAsyncEnumerable<object?[]> ReadRowsAsync(ValidatedReport report, int take, CancellationToken cancellationToken);
    Task<IReadOnlyList<(object? Value, long Count)>> GroupCountsAsync(ValidatedReport report, int take, CancellationToken cancellationToken);
}

public sealed record ReportPreviewColumn(string Key, string Label, string Kind);
public sealed record ReportPreviewGroup(string Label, long Count);
public sealed record ReportPreview(IReadOnlyList<ReportPreviewColumn> Columns, IReadOnlyList<string[]> Rows, long Total, string? GroupBy, IReadOnlyList<ReportPreviewGroup> Groups, int MaxRows, int AsyncThreshold);
