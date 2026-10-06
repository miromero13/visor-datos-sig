using ClosedXML.Excel;

namespace VisorDatosSig.Api;

public sealed class ExcelReportWriter : IReportWriter
{
    public const string DataSheetName = "Datos";
    public const string ParametersSheetName = "Parámetros";
    private const int AutoFitSampleRows = 500;
    private const double MaxColumnWidth = 60;
    private static readonly XLColor HeaderFill = XLColor.FromHtml("#0F172A");
    private static readonly XLColor TotalsFill = XLColor.FromHtml("#E2E8F0");

    public ExportFormat Format => ExportFormat.Xlsx;
    public string ContentType => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    public string Extension => "xlsx";

    public byte[] Write(ReportDocument document)
    {
        using var workbook = new XLWorkbook();
        workbook.Properties.Author = document.GeneratedBy;
        workbook.Properties.Title = document.Title;
        workbook.Properties.Company = document.CompanyName;
        WriteData(workbook.Worksheets.Add(DataSheetName), document);
        if (document.IncludeParametersSheet) WriteParameters(workbook.Worksheets.Add(ParametersSheetName), document);
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static void WriteData(IXLWorksheet sheet, ReportDocument document)
    {
        var columnCount = Math.Max(1, document.Columns.Count);
        sheet.Cell(1, 1).Value = $"{document.CompanyName} · {document.Title}";
        sheet.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(14);
        sheet.Cell(2, 1).Value = $"Generado el {document.GeneratedAt:dd/MM/yyyy HH:mm} por {document.GeneratedBy}";
        sheet.Cell(3, 1).Value = CellSanitizer.Sanitize("Filtros: " + string.Join(" · ", document.Parameters.Select(p => $"{p.Name}: {p.Value}")));
        sheet.Range(2, 1, 3, 1).Style.Font.SetFontColor(XLColor.FromHtml("#475569"));

        const int headerRow = 5;
        for (var c = 0; c < document.Columns.Count; c++) sheet.Cell(headerRow, c + 1).Value = document.Columns[c].Label;
        var header = sheet.Range(headerRow, 1, headerRow, columnCount);
        header.Style.Font.SetBold().Font.SetFontColor(XLColor.White).Fill.SetBackgroundColor(HeaderFill)
            .Alignment.SetVertical(XLAlignmentVerticalValues.Center);
        sheet.Row(headerRow).Height = 20;

        for (var r = 0; r < document.Rows.Count; r++)
        {
            var row = document.Rows[r];
            for (var c = 0; c < document.Columns.Count; c++) SetValue(sheet.Cell(headerRow + 1 + r, c + 1), document.Columns[c], row[c]);
        }

        var lastDataRow = headerRow + document.Rows.Count;
        if (document.Columns.Count > 0) sheet.Range(headerRow, 1, lastDataRow, columnCount).SetAutoFilter();
        sheet.SheetView.FreezeRows(headerRow);
        WriteTotals(sheet, document, lastDataRow + 1);

        for (var c = 1; c <= columnCount; c++)
        {
            var column = sheet.Column(c);
            column.AdjustToContents(headerRow, Math.Min(lastDataRow + 1, headerRow + AutoFitSampleRows));
            column.Width = Math.Clamp(column.Width + 2, 8, MaxColumnWidth);
        }
    }

    private static void WriteTotals(IXLWorksheet sheet, ReportDocument document, int rowNumber)
    {
        if (document.Columns.Count == 0) return;
        sheet.Cell(rowNumber, 1).Value = document.Rows.Count == 0 ? "Sin resultados para los filtros aplicados" : $"Total: {document.Rows.Count:N0} registros";
        for (var c = 0; c < document.Columns.Count; c++)
        {
            var column = document.Columns[c];
            if (!column.Summable || c == 0) continue;
            var sum = document.Rows.Sum(r => r[c] is not null && TryDecimal(r[c]!, out var n) ? n : 0m);
            var cell = sheet.Cell(rowNumber, c + 1);
            cell.Value = sum;
            cell.Style.NumberFormat.Format = NumberFormat(column.Kind);
        }
        sheet.Range(rowNumber, 1, rowNumber, document.Columns.Count).Style.Font.SetBold().Fill.SetBackgroundColor(TotalsFill);
    }

    private static void SetValue(IXLCell cell, ExportColumn column, object? value)
    {
        if (value is null) return;
        switch (column.Kind)
        {
            case ColumnKind.Integer when TryDecimal(value, out var number):
                cell.Value = number;
                cell.Style.NumberFormat.Format = "0";
                break;
            case ColumnKind.Decimal or ColumnKind.Coordinate or ColumnKind.Currency when TryDecimal(value, out var number):
                cell.Value = number;
                cell.Style.NumberFormat.Format = NumberFormat(column.Kind);
                break;
            case ColumnKind.Date when value is DateTime date:
                cell.Value = date;
                cell.Style.NumberFormat.Format = "dd/mm/yyyy hh:mm";
                break;
            case ColumnKind.Date when value is DateTimeOffset offset:
                cell.Value = offset.DateTime;
                cell.Style.NumberFormat.Format = "dd/mm/yyyy hh:mm";
                break;
            default:
                cell.Value = CellSanitizer.Sanitize(Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) ?? "");
                break;
        }
    }

    private static string NumberFormat(ColumnKind kind) => kind switch
    {
        ColumnKind.Coordinate => "0.000000",
        ColumnKind.Currency => "#,##0.00 \"Bs\"",
        ColumnKind.Integer => "#,##0",
        _ => "#,##0.00"
    };

    private static bool TryDecimal(object value, out decimal number)
    {
        try { number = Convert.ToDecimal(value, System.Globalization.CultureInfo.InvariantCulture); return true; }
        catch (Exception ex) when (ex is FormatException or InvalidCastException or OverflowException) { number = 0; return false; }
    }

    private static void WriteParameters(IXLWorksheet sheet, ReportDocument document)
    {
        var entries = new List<ReportParameter>
        {
            new("Reporte", document.Title),
            new("Empresa", document.CompanyName),
            new("Generado", document.GeneratedAt.ToString("dd/MM/yyyy HH:mm")),
            new("Usuario", document.GeneratedBy)
        };
        entries.AddRange(document.Parameters);
        entries.Add(new("Columnas", string.Join(", ", document.Columns.Select(c => c.Label))));
        sheet.Cell(1, 1).Value = "Parámetro";
        sheet.Cell(1, 2).Value = "Valor";
        sheet.Range(1, 1, 1, 2).Style.Font.SetBold().Font.SetFontColor(XLColor.White).Fill.SetBackgroundColor(HeaderFill);
        for (var i = 0; i < entries.Count; i++)
        {
            sheet.Cell(i + 2, 1).Value = entries[i].Name;
            sheet.Cell(i + 2, 2).Value = CellSanitizer.Sanitize(entries[i].Value);
        }
        sheet.Column(1).Style.Font.SetBold();
        sheet.Column(1).AdjustToContents();
        sheet.Column(2).AdjustToContents();
        sheet.Column(2).Width = Math.Min(sheet.Column(2).Width + 2, 100);
    }
}
