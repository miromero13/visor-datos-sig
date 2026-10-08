using System.Data;
using Xunit;

namespace VisorDatosSig.Api.Tests;

public sealed class ReportDefinitionTests
{
    private static ReportDefinition Definition(string layer = "CodigosFijos", string[]? columns = null, ReportFilter[]? filters = null, string? groupBy = null, ReportSort[]? sort = null, string? q = null, string? format = "xlsx", string? orientation = null, string? title = null) =>
        new(layer, columns, q, filters, groupBy, sort, format, orientation, title, true);

    [Fact]
    public void Uses_default_columns_and_title_when_not_given()
    {
        var report = ReportDefinitionValidator.Validate(Definition());
        Assert.Equal(ExportColumnCatalog.DefaultColumns("CodigosFijos").Select(c => c.Key), report.Columns.Select(c => c.Key));
        Assert.DoesNotContain(report.Columns, c => c.ReportOnly);
        Assert.Equal("Reporte de códigos fijos", report.Title);
    }

    [Fact]
    public void Keeps_the_requested_column_order_and_adds_the_group_column_first()
    {
        var report = ReportDefinitionValidator.Validate(Definition(columns: ["Nombre", "FechaCambioEstado", "CodFijo"], groupBy: "Estado"));
        Assert.Equal(["Estado", "Nombre", "FechaCambioEstado", "CodFijo"], report.Columns.Select(c => c.Key));
    }

    [Theory]
    [InlineData("PasswordHash")]
    [InlineData("Geom")]
    [InlineData("Nombre]; DROP TABLE dbo.Usuarios;--")]
    public void Rejects_fields_outside_the_catalog_everywhere(string field)
    {
        Assert.Throws<ArgumentException>(() => ReportDefinitionValidator.Validate(Definition(columns: [field])));
        Assert.Throws<ArgumentException>(() => ReportDefinitionValidator.Validate(Definition(filters: [new(field, "equals", "1", null, null)])));
        Assert.Throws<ArgumentException>(() => ReportDefinitionValidator.Validate(Definition(groupBy: field)));
        Assert.Throws<ArgumentException>(() => ReportDefinitionValidator.Validate(Definition(sort: [new(field, "asc")])));
    }

    [Theory]
    [InlineData("Nombre", "gte", "a", null)]            // text cannot use ranges
    [InlineData("CodFijo", "contains", "12", null)]     // numbers cannot use LIKE
    [InlineData("CodFijo", "equals", "doce", null)]     // not a number
    [InlineData("Estado", "equals", "9", null)]         // outside the allowed options
    [InlineData("FechaCambioEstado", "between", "2026-02-01", "2026-01-01")] // reversed range
    [InlineData("FechaCambioEstado", "gte", "06/10/2026", null)] // wrong date format
    [InlineData("Nombre", "equals", "", null)]          // empty value
    public void Rejects_operators_or_values_that_do_not_fit_the_column(string field, string op, string value, string? valueTo) =>
        Assert.Throws<ArgumentException>(() => ReportDefinitionValidator.Validate(Definition(filters: [new(field, op, value, valueTo, null)])));

    [Fact]
    public void Rejects_grouping_by_coordinates_and_invalid_output_options()
    {
        Assert.Throws<ArgumentException>(() => ReportDefinitionValidator.Validate(Definition(groupBy: "Latitud")));
        Assert.Throws<ArgumentException>(() => ReportDefinitionValidator.Validate(Definition(format: "docx")));
        Assert.Throws<ArgumentException>(() => ReportDefinitionValidator.Validate(Definition(orientation: "diagonal")));
        Assert.Throws<ArgumentException>(() => ReportDefinitionValidator.Validate(Definition(sort: [new("Nombre", "asc"), new("CodFijo", "asc"), new("IdLote", "asc"), new("Estado", "asc")])));
        Assert.Throws<KeyNotFoundException>(() => ReportDefinitionValidator.Validate(Definition(layer: "Usuarios")));
    }

    [Fact]
    public void Normalizes_the_definition_for_templates()
    {
        var report = ReportDefinitionValidator.Validate(Definition(columns: ["nombre"], filters: [new("estado", "IN", null, null, ["2", "3", "2"])], sort: [new("NOMBRE", "DESC")], q: "  Peña  ", format: "PDF"));
        var normalized = report.Normalized;
        Assert.Equal(["Nombre"], normalized.Columns);
        Assert.Equal("Peña", normalized.Q);
        var filter = normalized.Filters!.Single();
        Assert.Equal(("Estado", "in"), (filter.Field, filter.Operator));
        Assert.Equal(["2", "3"], filter.Values);
        Assert.Equal(("Nombre", "desc"), (normalized.Sort!.Single().Field, normalized.Sort!.Single().Direction));
        Assert.Equal("pdf", normalized.Format);

        // A stored template validates again to the same report.
        var again = ReportDefinitionValidator.Validate(normalized);
        Assert.Equal(report.Columns, again.Columns);
        Assert.Equal(report.Filters.Single().Values, again.Filters.Single().Values);
    }

    [Fact]
    public void Query_builder_parameterizes_values_and_escapes_like_wildcards()
    {
        var hostile = "50%_x' OR 1=1;--[";
        var report = ReportDefinitionValidator.Validate(Definition(
            q: hostile,
            filters: [new("Nombre", "contains", hostile, null, null), new("Estado", "in", null, null, ["2", "3"]), new("FechaCambioEstado", "between", "2026-01-01", "2026-01-31", null)],
            groupBy: "Estado",
            sort: [new("Nombre", "desc")]));
        var query = ReportQueryBuilder.Build(report);

        Assert.Equal("CodigosFijos", query.Table);
        Assert.DoesNotContain("1=1", query.Where);
        Assert.DoesNotContain("50%", query.Where);
        Assert.Contains(query.Parameters, p => (string)p.Value == "%50\\%\\_x' OR 1=1;--\\[%");
        Assert.Contains("[Estado] IN (@p", query.Where);
        Assert.Equal(2, query.Parameters.Count(p => p.SqlDbType == SqlDbType.BigInt));
        // "Hasta 31/01" includes the whole day: < 2026-02-01.
        Assert.Contains(query.Parameters, p => p.SqlDbType == SqlDbType.DateTime2 && (DateTime)p.Value == new DateTime(2026, 2, 1));
        Assert.Equal("[Estado] ASC, [Nombre] DESC, [IdCodigo] ASC", query.OrderBy);
    }
}
