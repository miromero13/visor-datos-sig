using System.Runtime.CompilerServices;
using ClosedXML.Excel;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace VisorDatosSig.Api.Tests;

/// <summary>Returns fixed rows (already ordered as SQL would) for whatever columns the report asks for.</summary>
internal sealed class FakeReportDataSource(IReadOnlyList<Dictionary<string, object?>> rows) : IReportDataSource
{
    public ValidatedReport? LastReport { get; private set; }

    public static FakeReportDataSource FixedCodes(int count) => new(Enumerable.Range(1, count).Select(i => new Dictionary<string, object?>
    {
        ["IdCodigo"] = i, ["CodF_SQL"] = 1000 + i, ["CodF_SIG"] = $"SIG-{i}", ["CodFijo"] = 500 + i,
        ["Nombre"] = i % 4 == 0 ? "=cmd|' /C calc'!A0" : $"Peñaloza Ñandú {i}",
        ["Estado"] = (byte)((i - 1) * 3 / count + 1), // three consecutive state groups: 1, 2, 3
        ["FechaCambioEstado"] = new DateTime(2026, 1, 1).AddDays(i), ["IdLote"] = null,
        ["Longitud"] = -63.18, ["Latitud"] = -17.78
    }).ToList());

    public Task<long> CountAsync(ValidatedReport report, CancellationToken cancellationToken)
    {
        LastReport = report;
        return Task.FromResult((long)rows.Count);
    }

    public async IAsyncEnumerable<object?[]> ReadRowsAsync(ValidatedReport report, int take, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        foreach (var row in rows.Take(take)) yield return report.Columns.Select(c => row.GetValueOrDefault(c.Key)).ToArray();
        await Task.CompletedTask;
    }

    public Task<IReadOnlyList<(object? Value, long Count)>> GroupCountsAsync(ValidatedReport report, int take, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<(object?, long)>>(rows.GroupBy(r => r[report.GroupBy!.Key]).Take(take).Select(g => (g.Key, (long)g.Count())).ToList());
}

public sealed class ReportServiceTests
{
    internal static IConfiguration Config(int maxRows = 50_000, int asyncThreshold = 5_000) => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["Reports:MaxRows"] = maxRows.ToString(), ["Reports:AsyncThreshold"] = asyncThreshold.ToString()
    }).Build();

    private static ReportService Service(IReportDataSource source, int maxRows = 50_000) =>
        new(source, [new ExcelReportWriter(), new PdfReportWriter()], Config(maxRows), new FixedClock(new DateTimeOffset(2026, 10, 6, 18, 30, 0, TimeSpan.Zero)));

    private static ReportDefinition Grouped(string format) => new("CodigosFijos", ["CodFijo", "Nombre", "FechaCambioEstado"], null,
        [new("FechaCambioEstado", "between", "2026-01-01", "2026-12-31", null), new("Estado", "in", null, null, ["1", "2", "3"])],
        "Estado", [new("CodFijo", "desc")], format, "auto", "Códigos por estado", true);

    [Fact]
    public async Task Preview_formats_the_first_rows_and_counts_every_group()
    {
        var preview = await Service(FakeReportDataSource.FixedCodes(120)).PreviewAsync(Grouped("xlsx"), default);
        Assert.Equal(120, preview.Total);
        Assert.Equal(ReportService.PreviewRows, preview.Rows.Count);
        Assert.Equal(["Estado", "Código fijo", "Nombre", "Fecha de cambio de estado"], preview.Columns.Select(c => c.Label));
        Assert.Equal(["Normal", "501", "Peñaloza Ñandú 1", "02/01/2026 00:00"], preview.Rows[0]);
        Assert.Equal([("Normal", 40L), ("Para corte", 40L), ("Cortado", 40L)], preview.Groups.Select(g => (g.Label, g.Count)));
    }

    [Fact]
    public async Task Excel_report_has_a_subtotal_after_each_group_and_a_grand_total()
    {
        var file = await Service(FakeReportDataSource.FixedCodes(9)).GenerateAsync(ReportDefinitionValidator.Validate(Grouped("xlsx")), "María Núñez", default);
        using var workbook = new XLWorkbook(new MemoryStream(file.Content));
        var sheet = workbook.Worksheet("Datos");
        // Header at row 5; 3 groups of 3 rows each followed by their subtotal.
        Assert.Equal("Subtotal Estado Normal: 3 registros", sheet.Cell(9, 1).GetString());
        Assert.Equal("Subtotal Estado Para corte: 3 registros", sheet.Cell(13, 1).GetString());
        Assert.Equal("Subtotal Estado Cortado: 3 registros", sheet.Cell(17, 1).GetString());
        Assert.Equal("Total: 9 registros", sheet.Cell(18, 1).GetString());
        Assert.Equal(1, sheet.Row(6).OutlineLevel);
        Assert.Equal(0, sheet.Row(9).OutlineLevel);
        Assert.Equal(XLDataType.DateTime, sheet.Cell(6, 4).DataType);
        Assert.True(sheet.Cell(10, 3).Style.IncludeQuotePrefix, "Formula-like names must stay literal text.");
        Assert.Contains("Estado: uno de: Normal, Para corte, Cortado", sheet.Cell(3, 1).GetString());
        Assert.Contains("Agrupado por: Estado", sheet.Cell(3, 1).GetString());
        Assert.Equal("reporte_codigos_fijos_2026-10-06_1430.xlsx", file.FileName);
    }

    [Fact]
    public async Task Pdf_report_with_groups_renders_and_names_the_file()
    {
        var file = await Service(FakeReportDataSource.FixedCodes(300)).GenerateAsync(ReportDefinitionValidator.Validate(Grouped("pdf")), "Ana", default);
        Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString(file.Content, 0, 4));
        Assert.Equal("reporte_codigos_fijos_2026-10-06_1430.pdf", file.FileName);
    }

    [Fact]
    public async Task Rejects_reports_above_the_row_limit()
    {
        var error = await Assert.ThrowsAsync<ExportTooLargeException>(() =>
            Service(FakeReportDataSource.FixedCodes(11), maxRows: 10).GenerateAsync(ReportDefinitionValidator.Validate(Grouped("xlsx")), "Ana", default));
        Assert.Equal(11, error.Total);
    }

    [Fact]
    public async Task Empty_reports_are_valid_files()
    {
        var file = await Service(new FakeReportDataSource([])).GenerateAsync(ReportDefinitionValidator.Validate(Grouped("xlsx")), "Ana", default);
        using var workbook = new XLWorkbook(new MemoryStream(file.Content));
        Assert.Equal("Sin resultados para los filtros aplicados", workbook.Worksheet("Datos").Cell(6, 1).GetString());
    }

    [Fact]
    public void Grouping_splits_consecutive_runs_and_labels_empty_values()
    {
        var document = new ReportDocument("t", "c", [new("G", "G", ColumnKind.Text)], [["A"], ["A"], [null], ["B"]], [], DateTime.Now, "u", ReportOrientation.Portrait, false, 0);
        Assert.Equal([new ReportGroup("A", 0, 2), new ReportGroup(ReportGrouping.EmptyGroupLabel, 2, 1), new ReportGroup("B", 3, 1)], ReportGrouping.Groups(document));
    }
}
