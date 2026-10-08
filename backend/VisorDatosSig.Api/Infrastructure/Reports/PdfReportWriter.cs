using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace VisorDatosSig.Api;

public sealed class PdfReportWriter : IReportWriter
{
    private static readonly CultureInfo Culture = CultureInfo.GetCultureInfo("es-BO");
    private const string Ink = "#0F172A";
    private const string Muted = "#64748B";
    private const string Stripe = "#F1F5F9";
    private const string Rule = "#CBD5E1";

    // Same mark as the frontend Brand component.
    private const string LogoSvg = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26">
          <rect x="1" y="1" width="24" height="24" rx="7" fill="#08142e" transform="rotate(-7 13 13)"/>
          <rect x="7" y="7" width="12" height="12" rx="3" fill="none" stroke="#7dd3fc" stroke-width="2.5"/>
        </svg>
        """;

    static PdfReportWriter() => QuestPDF.Settings.License = LicenseType.Community;

    public ExportFormat Format => ExportFormat.Pdf;
    public string ContentType => "application/pdf";
    public string Extension => "pdf";

    public byte[] Write(ReportDocument document) => Document.Create(container => container.Page(page =>
    {
        page.Size(document.Orientation == ReportOrientation.Landscape ? PageSizes.A4.Landscape() : PageSizes.A4.Portrait());
        page.Margin(28);
        page.DefaultTextStyle(style => style.FontSize(8.5f).FontColor(Ink));
        page.Header().Element(header => Header(header, document));
        page.Content().PaddingVertical(10).Element(content => Content(content, document));
        page.Footer().Element(footer => Footer(footer, document));
    })).WithMetadata(new DocumentMetadata { Title = document.Title, Author = document.GeneratedBy, Producer = document.CompanyName, Creator = document.CompanyName })
      .GeneratePdf();

    private static void Header(IContainer container, ReportDocument document) => container.Column(column =>
    {
        column.Item().Row(row =>
        {
            row.ConstantItem(26).Height(26).Svg(LogoSvg);
            row.RelativeItem().PaddingLeft(8).Column(title =>
            {
                title.Item().Text(document.CompanyName).Bold().FontSize(9).FontColor(Muted);
                title.Item().Text(document.Title).Bold().FontSize(14);
            });
            row.AutoItem().AlignRight().AlignMiddle().Text($"Generado: {document.GeneratedAt:dd/MM/yyyy HH:mm}").FontColor(Muted);
        });
        column.Item().PaddingTop(6).Text(text =>
        {
            text.DefaultTextStyle(style => style.FontSize(7.5f).FontColor(Muted));
            for (var i = 0; i < document.Parameters.Count; i++)
            {
                if (i > 0) text.Span("  ·  ");
                text.Span(document.Parameters[i].Name + ": ").SemiBold();
                text.Span(document.Parameters[i].Value);
            }
        });
        column.Item().PaddingTop(6).LineHorizontal(1).LineColor(Rule);
    });

    private static void Content(IContainer container, ReportDocument document)
    {
        if (document.Rows.Count == 0 || document.Columns.Count == 0)
        {
            container.PaddingTop(20).AlignCenter().Text("Sin resultados para los filtros aplicados.").FontColor(Muted).FontSize(10);
            return;
        }
        container.Column(column =>
        {
            column.Item().Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    foreach (var c in document.Columns)
                    {
                        if (c.Kind == ColumnKind.Text) columns.RelativeColumn(2);
                        else columns.RelativeColumn(1);
                    }
                });
                table.Header(header =>
                {
                    foreach (var c in document.Columns)
                        header.Cell().Background(Ink).PaddingVertical(5).PaddingHorizontal(4).Element(cell => Align(cell, c))
                            .Text(c.Label).Bold().FontColor(Colors.White);
                });
                void Rows(int start, int count)
                {
                    for (var r = start; r < start + count; r++)
                    {
                        var background = (r - start) % 2 == 1 ? Stripe : "#FFFFFF";
                        for (var c = 0; c < document.Columns.Count; c++)
                            table.Cell().Background(background).BorderBottom(0.5f).BorderColor(Rule).ShowEntire()
                                .PaddingVertical(3).PaddingHorizontal(4).Element(cell => Align(cell, document.Columns[c]))
                                .Text(FormatValue(document.Columns[c], document.Rows[r][c]));
                    }
                }
                var groups = ReportGrouping.Groups(document);
                if (groups.Count == 0) Rows(0, document.Rows.Count);
                var groupLabel = document.GroupColumnIndex is { } index ? document.Columns[index].Label : "";
                foreach (var group in groups)
                {
                    table.Cell().ColumnSpan((uint)document.Columns.Count).ShowEntire().PaddingTop(6).Background("#E2E8F0").PaddingVertical(4).PaddingHorizontal(4)
                        .Text($"{groupLabel}: {group.Label}").Bold();
                    Rows(group.Start, group.Count);
                    table.Cell().ColumnSpan((uint)document.Columns.Count).ShowEntire().Background(Stripe).PaddingVertical(4).PaddingHorizontal(4)
                        .Text(text => Summary(text, document, $"Subtotal {group.Label}: {group.Count.ToString("N0", Culture)} registros", group.Start, group.Count));
                }
            });
            column.Item().ShowEntire().PaddingTop(8).Background("#E2E8F0").Padding(6)
                .Text(text => Summary(text, document, $"Total: {document.Rows.Count.ToString("N0", Culture)} registros", 0, document.Rows.Count));
        });
    }

    private static void Summary(TextDescriptor text, ReportDocument document, string label, int start, int count)
    {
        text.Span(label).Bold();
        for (var c = 0; c < document.Columns.Count; c++)
        {
            var column = document.Columns[c];
            if (column.Summable) text.Span($"   ·   {column.Label}: {FormatValue(column, ReportGrouping.Sum(document.Rows, c, start, count))}");
        }
    }

    private static IContainer Align(IContainer cell, ExportColumn column) =>
        column.Kind is ColumnKind.Integer or ColumnKind.Decimal or ColumnKind.Coordinate or ColumnKind.Currency ? cell.AlignRight() : cell.AlignLeft();

    private static void Footer(IContainer container, ReportDocument document) => container.BorderTop(0.5f).BorderColor(Rule).PaddingTop(4).Row(row =>
    {
        row.RelativeItem().Text($"Generado por {document.GeneratedBy} · {document.CompanyName}").FontSize(7.5f).FontColor(Muted);
        row.AutoItem().Text(text =>
        {
            text.DefaultTextStyle(style => style.FontSize(7.5f).FontColor(Muted));
            text.Span("Página ");
            text.CurrentPageNumber();
            text.Span(" de ");
            text.TotalPages();
        });
    });

    public static string FormatValue(ExportColumn column, object? value)
    {
        if (value is null) return "—";
        var numeric = TryDecimal(value, out var number);
        return column.Kind switch
        {
            ColumnKind.Integer when numeric => number.ToString("0", Culture),
            ColumnKind.Decimal when numeric => number.ToString("N2", Culture),
            ColumnKind.Coordinate when numeric => number.ToString("0.000000", Culture),
            ColumnKind.Currency when numeric => "Bs " + number.ToString("N2", Culture),
            ColumnKind.Date when value is DateTime date => date.ToString("dd/MM/yyyy HH:mm", Culture),
            ColumnKind.Date when value is DateTimeOffset offset => offset.ToString("dd/MM/yyyy HH:mm", Culture),
            _ => Convert.ToString(value, CultureInfo.InvariantCulture) ?? ""
        };
    }

    private static bool TryDecimal(object value, out decimal number)
    {
        try { number = Convert.ToDecimal(value, CultureInfo.InvariantCulture); return true; }
        catch (Exception ex) when (ex is FormatException or InvalidCastException or OverflowException) { number = 0; return false; }
    }
}
