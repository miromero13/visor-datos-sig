namespace VisorDatosSig.Api;

/// <summary>
/// Prevents spreadsheet formula injection (OWASP CSV/Formula Injection): text that a spreadsheet could evaluate gets a leading apostrophe.
/// ClosedXML stores that apostrophe as Excel's native quotePrefix flag, so the cell keeps its original text and is never evaluated.
/// </summary>
public static class CellSanitizer
{
    private static readonly char[] DangerousPrefixes = ['=', '+', '-', '@', '\t', '\r', '\n'];

    public static bool IsDangerous(string? value) => !string.IsNullOrEmpty(value) && DangerousPrefixes.Contains(value[0]);

    public static string Sanitize(string value) => IsDangerous(value) ? "'" + value : value;
}
