using Xunit;

namespace VisorDatosSig.Api.Tests;

public sealed class MapPayloadTests
{
    [Theory]
    [InlineData("Lotes", "IdLote")]
    [InlineData("Manzanas", "IdManzana")]
    [InlineData("Vias", "IdVia")]
    public void Minimal_projection_keeps_layer_identifier_only(string layer, string id)
    {
        var minimal = LayerQueryService.ProjectAttributesForTests(layer, true);
        var full = LayerQueryService.ProjectAttributesForTests(layer, false);
        Assert.Equal(new[] { id }, minimal);
        Assert.Contains(id == "IdVia" ? "OBJECTID" : "IdOrigen", full);
        Assert.Contains(id, minimal);
    }

    [Fact]
    public void Geojson_page_cap_is_5000_and_default_remains_1000()
    {
        Assert.Equal(5000, LayerQueryService.MaxFeatures);
        Assert.Equal(1000, LayerQueryService.DefaultFeatures);
    }

    [Fact]
    public void Fixed_code_projection_preserves_styling_filters_and_identifier()
    {
        var minimal = LayerQueryService.ProjectAttributesForTests("CodigosFijos", true);
        var full = LayerQueryService.ProjectAttributesForTests("CodigosFijos", false);
        Assert.Equal(new[] { "CodF_SQL", "CodF_SIG", "CodFijo", "Nombre", "Estado", "IdCodigo" }, minimal);
        Assert.Contains("IdLote", full);
        Assert.Contains("Longitud", full);
        Assert.Contains("IdCodigo", full);
    }
}
