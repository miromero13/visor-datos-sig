using System.Globalization;

namespace VisorDatosSig.Api;

/// <summary>A run of consecutive rows sharing the group column value (rows arrive ordered by that column).</summary>
public sealed record ReportGroup(string Label, int Start, int Count);

/// <summary>Grouping and totals shared by the Excel and PDF writers, so both files show the same subtotals.</summary>
public static class ReportGrouping
{
    public const string EmptyGroupLabel = "(sin dato)";

    public static IReadOnlyList<ReportGroup> Groups(ReportDocument document)
    {
        if (document.GroupColumnIndex is not { } index || document.Rows.Count == 0) return [];
        var groups = new List<ReportGroup>();
        var start = 0;
        for (var r = 1; r <= document.Rows.Count; r++)
        {
            if (r < document.Rows.Count && Equals(document.Rows[r][index], document.Rows[start][index])) continue;
            groups.Add(new(Label(document.Rows[start][index]), start, r - start));
            start = r;
        }
        return groups;
    }

    public static string Label(object? value) => value switch
    {
        null => EmptyGroupLabel,
        string text when string.IsNullOrWhiteSpace(text) => EmptyGroupLabel,
        IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString() ?? EmptyGroupLabel
    };

    /// <summary>Sum of a summable column over a row range; non-numeric values are ignored.</summary>
    public static decimal Sum(IReadOnlyList<object?[]> rows, int column, int start = 0, int? count = null)
    {
        var total = 0m;
        var end = start + (count ?? rows.Count - start);
        for (var r = start; r < end; r++)
        {
            if (rows[r][column] is not { } value) continue;
            try { total += Convert.ToDecimal(value, CultureInfo.InvariantCulture); }
            catch (Exception ex) when (ex is FormatException or InvalidCastException or OverflowException) { }
        }
        return total;
    }
}
