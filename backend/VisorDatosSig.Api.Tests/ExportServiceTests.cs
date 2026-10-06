using System.Runtime.CompilerServices;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace VisorDatosSig.Api.Tests;

/// <summary>In-memory stand-in for SQL Server: records the criteria it receives and returns generated rows.</summary>
internal sealed class FakeExportSource(long total, Func<long, string[], object?[]>? rowFactory = null) : IExportRowSource
{
    private static readonly SearchQueryService Allowlist = new(new ConfigurationBuilder().Build());
    public SearchCriteria? LastCriteria { get; private set; }
    public (long Offset, int Take, string[] Columns)? LastRead { get; private set; }

    public bool HasLayer(string layer) => Allowlist.HasLayer(layer);
    public bool IsApprovedColumn(string layer, string column) => Allowlist.IsApprovedColumn(layer, column);

    public Task<long> CountAsync(SearchCriteria criteria, CancellationToken cancellationToken)
    {
        LastCriteria = criteria;
        return Task.FromResult(total);
    }

    public async IAsyncEnumerable<object?[]> ReadRowsAsync(SearchCriteria criteria, IReadOnlyList<string> columns, long offset, int take, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        LastRead = (offset, take, columns.ToArray());
        var end = Math.Min(total, offset + take);
        for (var i = offset; i < end; i++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            yield return rowFactory?.Invoke(i, columns.ToArray()) ?? columns.Select(c => (object?)(c.StartsWith("Id", StringComparison.Ordinal) || c is "Estado" or "CodFijo" or "CodF_SQL" ? (int)(i % 5) + 1 : $"valor {i}")).ToArray();
        }
        await Task.CompletedTask;
    }
}

internal sealed class FixedClock(DateTimeOffset now) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => now;
}

public sealed class ExportServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 6, 18, 30, 0, TimeSpan.Zero); // 14:30 in La Paz (UTC-4)

    internal static ExportService CreateService(IExportRowSource source, int maxRows = 50_000) => new(
        source,
        [new ExcelReportWriter(), new PdfReportWriter()],
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Reports:MaxRows"] = maxRows.ToString() }).Build(),
        new FixedClock(Now));

    private static ExportRequest Request(string format = "xlsx", string scope = "page", Dictionary<string, string?>? filters = null, string[]? columns = null, string? q = null, string layer = "CodigosFijos", int page = 1, string? sortBy = null, string? orientation = null) =>
        new(layer, format, scope, q, filters, sortBy, "asc", columns, page, 25, orientation, true);

    [Fact]
    public async Task Passes_search_filters_and_sort_to_the_source_exactly_as_received()
    {
        var source = new FakeExportSource(100);
        await CreateService(source).ExportAsync(Request(filters: new() { ["Estado"] = "2", ["Nombre"] = " Peña " }, q: "  calle ", sortBy: "Nombre"), "Ana", default);

        Assert.Equal("CodigosFijos", source.LastCriteria!.Layer);
        Assert.Equal("calle", source.LastCriteria.Q);
        Assert.Equal("2", source.LastCriteria.Filters["Estado"]);
        Assert.Equal("Peña", source.LastCriteria.Filters["nombre"]);
        Assert.Equal("Nombre", source.LastCriteria.SortBy);
    }

    [Fact]
    public async Task Page_scope_reads_only_the_visible_page_and_all_scope_reads_every_row()
    {
        var source = new FakeExportSource(130);
        await CreateService(source).ExportAsync(Request(scope: "page", page: 3), "Ana", default);
        Assert.Equal((50L, 25), (source.LastRead!.Value.Offset, source.LastRead.Value.Take));

        await CreateService(source).ExportAsync(Request(scope: "all"), "Ana", default);
        Assert.Equal((0L, 130), (source.LastRead!.Value.Offset, source.LastRead.Value.Take));
    }

    [Fact]
    public async Task Exports_only_the_visible_columns_in_the_requested_order()
    {
        var source = new FakeExportSource(3);
        await CreateService(source).ExportAsync(Request(columns: ["Nombre", "CodFijo", "Estado"]), "Ana", default);
        Assert.Equal(["Nombre", "CodFijo", "Estado"], source.LastRead!.Value.Columns);
    }

    [Theory]
    [InlineData("Nombre]; DROP TABLE dbo.Usuarios;--")]
    [InlineData("PasswordHash")]
    [InlineData("Geom")]
    public async Task Rejects_columns_filters_and_sort_fields_outside_the_allowlist(string field)
    {
        var service = CreateService(new FakeExportSource(1));
        await Assert.ThrowsAsync<ArgumentException>(() => service.ExportAsync(Request(columns: [field]), "Ana", default));
        await Assert.ThrowsAsync<ArgumentException>(() => service.ExportAsync(Request(filters: new() { [field] = "x" }), "Ana", default));
        await Assert.ThrowsAsync<ArgumentException>(() => service.ExportAsync(Request(sortBy: field), "Ana", default));
    }

    [Theory]
    [InlineData("csv", "page")]
    [InlineData("xlsx", "everything")]
    public async Task Rejects_unknown_format_or_scope(string format, string scope) =>
        await Assert.ThrowsAsync<ArgumentException>(() => CreateService(new FakeExportSource(1)).ExportAsync(Request(format, scope), "Ana", default));

    [Fact]
    public async Task Rejects_unknown_layers_and_oversized_text()
    {
        var service = CreateService(new FakeExportSource(1));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.ExportAsync(Request(layer: "Usuarios"), "Ana", default));
        await Assert.ThrowsAsync<ArgumentException>(() => service.ExportAsync(Request(q: new string('a', 201)), "Ana", default));
    }

    [Fact]
    public async Task Refuses_all_results_above_the_configured_limit_before_reading_rows()
    {
        var source = new FakeExportSource(1_001);
        var error = await Assert.ThrowsAsync<ExportTooLargeException>(() => CreateService(source, maxRows: 1_000).ExportAsync(Request(scope: "all"), "Ana", default));
        Assert.Equal(1_001, error.Total);
        Assert.Null(source.LastRead);
    }

    [Theory]
    [InlineData("xlsx", "reporte_codigos_fijos_2026-10-06_1430.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    [InlineData("pdf", "reporte_codigos_fijos_2026-10-06_1430.pdf", "application/pdf")]
    public async Task Names_files_with_module_and_local_timestamp(string format, string expectedName, string contentType)
    {
        var file = await CreateService(new FakeExportSource(2)).ExportAsync(Request(format), "Ana", default);
        Assert.Equal(expectedName, file.FileName);
        Assert.Equal(contentType, file.ContentType);
        Assert.NotEmpty(file.Content);
    }

    [Fact]
    public async Task Empty_results_still_produce_valid_files()
    {
        var service = CreateService(new FakeExportSource(0));
        var excel = await service.ExportAsync(Request("xlsx", "all"), "Ana", default);
        var pdf = await service.ExportAsync(Request("pdf", "all"), "Ana", default);
        using var workbook = new ClosedXML.Excel.XLWorkbook(new MemoryStream(excel.Content));
        Assert.Equal("Sin resultados para los filtros aplicados", workbook.Worksheet("Datos").Cell(6, 1).GetString());
        Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString(pdf.Content, 0, 4));
    }

    [Fact]
    public async Task Large_export_of_all_results_completes()
    {
        const int rows = 50_000;
        var source = new FakeExportSource(rows);
        var service = CreateService(source);
        var started = System.Diagnostics.Stopwatch.StartNew();
        var file = await service.ExportAsync(Request("xlsx", "all"), "Ana", default);
        started.Stop();

        using var workbook = new ClosedXML.Excel.XLWorkbook(new MemoryStream(file.Content));
        var sheet = workbook.Worksheet("Datos");
        Assert.Equal($"Total: {rows:N0} registros", sheet.Cell(5 + rows + 1, 1).GetString());
        Assert.True(started.Elapsed < TimeSpan.FromSeconds(60), $"Export took {started.Elapsed}.");
    }

    [Fact]
    public async Task Summary_describes_filters_with_readable_labels()
    {
        var file = await CreateService(new FakeExportSource(1)).ExportAsync(Request(filters: new() { ["Estado"] = "2" }, q: "Ñandú"), "Ana", default);
        using var workbook = new ClosedXML.Excel.XLWorkbook(new MemoryStream(file.Content));
        var summary = workbook.Worksheet("Datos").Cell(3, 1).GetString();
        Assert.Contains("Estado: Para corte (2)", summary);
        Assert.Contains("Búsqueda: \"Ñandú\"", summary);
        Assert.Contains("Página 1 (25 por página)", summary);
    }

    [Fact]
    public void Search_query_builder_parameterizes_every_user_value()
    {
        var hostile = "x' OR 1=1; DROP TABLE dbo.Usuarios;--";
        var query = SearchQueryService.Build(new SearchCriteria("Vias", hostile, new Dictionary<string, string?> { ["Nombre"] = hostile, ["TipoVia"] = hostile }, "Nombre", "desc"));
        Assert.DoesNotContain("DROP", query.Where);
        Assert.DoesNotContain("1=1", query.Where);
        Assert.All(query.Parameters, p => Assert.StartsWith("@", p.ParameterName));
        Assert.Contains(query.Parameters, p => (string)p.Value == hostile);
        Assert.Equal("[Nombre] DESC, [IdVia] ASC", query.OrderBy);
        Assert.Throws<ArgumentException>(() => SearchQueryService.Build(new SearchCriteria("Vias", null, new Dictionary<string, string?>(), "Nombre; --", null)));
    }
}
