using VisorDatosSig.Api;
using Xunit;

namespace VisorDatosSig.Api.Tests;

public sealed class ShapefileSourceAnalyzerTests
{
    [Fact]
    public void Groups_required_components_by_basename_case_insensitively()
    {
        var layers = ShapefileSourceAnalyzer.Analyze(["Roads.SHP", "roads.ShX", "ROADS.dbf", "roads.PrJ", "notes.txt"]);
        var layer = Assert.Single(layers);
        Assert.Equal("Roads", layer.Name);
        Assert.True(layer.Complete);
        Assert.Empty(layer.MissingExtensions);
        Assert.Equal(4, layer.Files.Count);
    }

    [Theory]
    [InlineData("C:\\data\\roads.shp", "roads")]
    [InlineData("C:/data/roads.shp", "roads")]
    public void Normalizes_windows_paths_before_grouping_and_display(string filename, string expectedName)
    {
        var layer = Assert.Single(ShapefileSourceAnalyzer.Analyze([filename]));
        Assert.Equal(expectedName, layer.Name);
        Assert.Equal("roads.shp", Assert.Single(layer.Files));
        Assert.Equal([".shx", ".dbf", ".prj"], layer.MissingExtensions);
    }

    [Fact]
    public void Reports_missing_projection_and_other_required_components()
    {
        var layer = Assert.Single(ShapefileSourceAnalyzer.Analyze(["Parcels.shp", "Parcels.dbf"]));
        Assert.False(layer.Complete);
        Assert.Equal([".shx", ".prj"], layer.MissingExtensions);
    }
}
