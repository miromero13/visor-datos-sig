using System.Text;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using Xunit;

namespace VisorDatosSig.Api.Tests;

public sealed class ReportWriterTests
{
    private static readonly ExportColumn[] Columns =
    [
        new("Id", "ID", ColumnKind.Integer),
        new("Nombre", "Nombre", ColumnKind.Text),
        new("Monto", "Monto", ColumnKind.Currency, Summable: true),
        new("Fecha", "Fecha de cambio", ColumnKind.Date),
        new("Latitud", "Latitud", ColumnKind.Coordinate)
    ];

    private static ReportDocument Document(IReadOnlyList<object?[]> rows, ExportColumn[]? columns = null, ReportOrientation orientation = ReportOrientation.Portrait, bool parameters = true) => new(
        "Reporte de códigos fijos", "VisorDatosSIG", columns ?? Columns, rows,
        [new("Capa", "Códigos fijos"), new("Nombre", "Peñaloza")],
        new DateTime(2026, 10, 6, 14, 30, 0), "María Núñez", orientation, parameters);

    private static readonly object?[][] SampleRows =
    [
        [1, "Peñaloza Ñandú", 1500.5m, new DateTime(2026, 1, 15, 9, 0, 0), -17.783327],
        [2, "=HYPERLINK(\"http://evil\",\"x\")", 99.5m, null, -17.79],
        [3, "+cmd|' /C calc'!A0", null, new DateTime(2026, 2, 1), null],
        [4, "@SUM(1+1)", 0m, null, -17.8],
        [5, "-2+3", 10m, null, -17.81]
    ];

    private static XLWorkbook Excel(ReportDocument document) => new(new MemoryStream(new ExcelReportWriter().Write(document)));

    [Fact]
    public void Excel_header_is_bold_filled_frozen_and_filtered()
    {
        using var workbook = Excel(Document(SampleRows));
        var sheet = workbook.Worksheet(ExcelReportWriter.DataSheetName);
        var header = sheet.Cell(5, 1);
        Assert.Equal("ID", header.GetString());
        Assert.True(header.Style.Font.Bold);
        Assert.Equal(XLColor.FromHtml("#0F172A"), header.Style.Fill.BackgroundColor);
        Assert.Equal(5, sheet.SheetView.SplitRow);
        Assert.True(sheet.AutoFilter.IsEnabled);
        Assert.Equal("A5:E10", sheet.AutoFilter.Range.RangeAddress.ToString());
        Assert.All(Enumerable.Range(1, 5), c => Assert.InRange(sheet.Column(c).Width, 8, 60));
    }

    [Fact]
    public void Excel_keeps_numbers_dates_and_currency_as_typed_values()
    {
        using var workbook = Excel(Document(SampleRows));
        var sheet = workbook.Worksheet(ExcelReportWriter.DataSheetName);
        Assert.Equal(XLDataType.Number, sheet.Cell(6, 1).DataType);
        Assert.Equal(1m, sheet.Cell(6, 1).GetValue<decimal>());
        Assert.Equal(XLDataType.Number, sheet.Cell(6, 3).DataType);
        Assert.Contains("Bs", sheet.Cell(6, 3).Style.NumberFormat.Format);
        Assert.Equal(XLDataType.DateTime, sheet.Cell(6, 4).DataType);
        Assert.Equal(new DateTime(2026, 1, 15, 9, 0, 0), sheet.Cell(6, 4).GetDateTime());
        Assert.Equal(XLDataType.Number, sheet.Cell(6, 5).DataType);
        Assert.Equal("0.000000", sheet.Cell(6, 5).Style.NumberFormat.Format);
        Assert.True(sheet.Cell(7, 4).IsEmpty());
    }

    [Fact]
    public void Excel_preserves_accents_and_escapes_formula_like_text()
    {
        using var workbook = Excel(Document(SampleRows));
        var sheet = workbook.Worksheet(ExcelReportWriter.DataSheetName);
        Assert.Equal("Peñaloza Ñandú", sheet.Cell(6, 2).GetString());
        foreach (var (row, text) in new[] { (7, "=HYPERLINK(\"http://evil\",\"x\")"), (8, "+cmd|' /C calc'!A0"), (9, "@SUM(1+1)"), (10, "-2+3") })
        {
            var cell = sheet.Cell(row, 2);
            Assert.False(cell.HasFormula);
            Assert.Equal(XLDataType.Text, cell.DataType);
            Assert.True(cell.Style.IncludeQuotePrefix, $"Row {row} is not forced to literal text.");
            Assert.Equal(text, cell.GetString());
        }
        Assert.False(sheet.Cell(6, 2).Style.IncludeQuotePrefix);
        Assert.Equal("María Núñez", workbook.Properties.Author);
    }

    [Fact]
    public void Excel_totals_row_counts_records_and_sums_summable_columns()
    {
        using var workbook = Excel(Document(SampleRows));
        var sheet = workbook.Worksheet(ExcelReportWriter.DataSheetName);
        Assert.Equal("Total: 5 registros", sheet.Cell(11, 1).GetString());
        Assert.Equal(1610m, sheet.Cell(11, 3).GetValue<decimal>());
        Assert.True(sheet.Cell(11, 1).Style.Font.Bold);
    }

    [Fact]
    public void Excel_parameters_sheet_is_optional()
    {
        using var with = Excel(Document(SampleRows));
        var parameters = with.Worksheet(ExcelReportWriter.ParametersSheetName);
        Assert.Contains(parameters.Column(1).CellsUsed(), c => c.GetString() == "Usuario");
        Assert.Contains(parameters.Column(2).CellsUsed(), c => c.GetString() == "Peñaloza");

        using var without = Excel(Document(SampleRows, parameters: false));
        Assert.False(without.Worksheets.Contains(ExcelReportWriter.ParametersSheetName));
    }

    [Theory]
    [InlineData("=1+1", "'=1+1")]
    [InlineData("+54", "'+54")]
    [InlineData("-x", "'-x")]
    [InlineData("@cmd", "'@cmd")]
    [InlineData("\tTab", "'\tTab")]
    [InlineData("Calle 1 = A", "Calle 1 = A")]
    [InlineData("Ñuflo de Chávez", "Ñuflo de Chávez")]
    public void Sanitizer_only_escapes_dangerous_prefixes(string input, string expected) => Assert.Equal(expected, CellSanitizer.Sanitize(input));

    private static string PdfText(byte[] pdf) => Encoding.Latin1.GetString(pdf);

    [Fact]
    public void Pdf_is_generated_with_accented_text()
    {
        var pdf = new PdfReportWriter().Write(Document(SampleRows));
        Assert.StartsWith("%PDF", PdfText(pdf));
        Assert.True(pdf.Length > 1_000);
    }

    [Theory]
    [InlineData(ReportOrientation.Portrait)]
    [InlineData(ReportOrientation.Landscape)]
    public void Pdf_uses_the_requested_orientation(ReportOrientation orientation)
    {
        var text = PdfText(new PdfReportWriter().Write(Document(SampleRows, orientation: orientation)));
        var box = Regex.Match(text, @"/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]");
        Assert.True(box.Success, "MediaBox not found");
        var width = double.Parse(box.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture);
        var height = double.Parse(box.Groups[2].Value, System.Globalization.CultureInfo.InvariantCulture);
        Assert.Equal(orientation == ReportOrientation.Landscape, width > height);
    }

    [Fact]
    public void Pdf_paginates_many_rows()
    {
        var rows = Enumerable.Range(1, 400).Select(i => new object?[] { i, $"Vía Ñ {i}", i * 1.5m, new DateTime(2026, 1, 1), -17.7 }).ToArray();
        var text = PdfText(new PdfReportWriter().Write(Document(rows)));
        Assert.True(Regex.Matches(text, @"/Type\s*/Page[^s]").Count > 5);
    }

    [Fact]
    public void Pdf_formats_values_for_bolivian_readers()
    {
        Assert.Equal("Bs 1.500,50", PdfReportWriter.FormatValue(Columns[2], 1500.5m));
        Assert.Equal("15/01/2026 09:00", PdfReportWriter.FormatValue(Columns[3], new DateTime(2026, 1, 15, 9, 0, 0)));
        Assert.Equal("—", PdfReportWriter.FormatValue(Columns[1], null));
        Assert.Equal("sin dato", PdfReportWriter.FormatValue(Columns[4], "sin dato"));
    }
}
