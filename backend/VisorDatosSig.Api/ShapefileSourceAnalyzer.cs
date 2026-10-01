namespace VisorDatosSig.Api;

public sealed record ShapefileLayerAnalysis(string Name, IReadOnlyList<string> Files, IReadOnlyList<string> MissingExtensions)
{
    public bool Complete => MissingExtensions.Count == 0;
}

public static class ShapefileSourceAnalyzer
{
    private static readonly string[] RequiredExtensions = [".shp", ".shx", ".dbf", ".prj"];

    public static IReadOnlyList<ShapefileLayerAnalysis> Analyze(IEnumerable<string> filenames)
    {
        var layers = new Dictionary<string, (string Name, List<string> Files, HashSet<string> Extensions)>(StringComparer.OrdinalIgnoreCase);
        foreach (var filename in filenames)
        {
            var name = Path.GetFileName(filename.Replace('\\', '/'));
            var extension = Path.GetExtension(name).ToLowerInvariant();
            if (!RequiredExtensions.Contains(extension, StringComparer.Ordinal)) continue;
            var basename = Path.GetFileNameWithoutExtension(name);
            if (!layers.TryGetValue(basename, out var layer))
                layer = (basename, [], new HashSet<string>(StringComparer.Ordinal));
            layer.Files.Add(name);
            layer.Extensions.Add(extension);
            layers[basename] = layer;
        }

        return layers.Values.Select(layer => new ShapefileLayerAnalysis(
            layer.Name,
            layer.Files,
            RequiredExtensions.Where(extension => !layer.Extensions.Contains(extension)).ToArray())).ToArray();
    }
}
