using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace VisorDatosSig.Api.Tests;

internal sealed class InMemoryTemplateStore : IReportTemplateStore
{
    private readonly ConcurrentDictionary<int, (int UserId, ReportTemplate Template)> templates = new();
    private int nextId;

    public Task<IReadOnlyList<ReportTemplate>> ListAsync(int userId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<ReportTemplate>>(templates.Values.Where(t => t.UserId == userId).Select(t => t.Template).ToList());
    public Task<ReportTemplate?> GetAsync(int id, int userId, CancellationToken cancellationToken) =>
        Task.FromResult(templates.TryGetValue(id, out var t) && t.UserId == userId ? t.Template : null);
    public Task<int> CountAsync(int userId, CancellationToken cancellationToken) => Task.FromResult(templates.Values.Count(t => t.UserId == userId));

    public Task<ReportTemplate> CreateAsync(int userId, string name, ReportDefinition definition, CancellationToken cancellationToken)
    {
        if (templates.Values.Any(t => t.UserId == userId && t.Template.Name == name)) throw new DuplicateTemplateNameException();
        var template = new ReportTemplate(Interlocked.Increment(ref nextId), name, definition.Layer!, definition, DateTime.Now, DateTime.Now);
        templates[template.Id] = (userId, template);
        return Task.FromResult(template);
    }

    public Task<ReportTemplate?> UpdateAsync(int id, int userId, string name, ReportDefinition definition, CancellationToken cancellationToken)
    {
        if (!templates.TryGetValue(id, out var current) || current.UserId != userId) return Task.FromResult<ReportTemplate?>(null);
        var template = current.Template with { Name = name, Layer = definition.Layer!, Definition = definition, UpdatedAt = DateTime.Now };
        templates[id] = (userId, template);
        return Task.FromResult<ReportTemplate?>(template);
    }

    public Task<bool> DeleteAsync(int id, int userId, CancellationToken cancellationToken) =>
        Task.FromResult(templates.TryGetValue(id, out var t) && t.UserId == userId && templates.TryRemove(id, out _));
}

public sealed class ReportEndpointTests
{
    private static async Task<(WebApplication App, HttpClient Client)> StartAsync(int rows, int asyncThreshold = 5_000)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseKestrel().UseUrls("http://127.0.0.1:0");
        builder.Configuration["Reports:AsyncThreshold"] = asyncThreshold.ToString();
        builder.Configuration["Reports:MaxRows"] = "1000";
        builder.Configuration["Reports:JobDirectory"] = Path.Combine(Path.GetTempPath(), "visordatossig-tests-" + Guid.NewGuid().ToString("N"));
        builder.Services.AddAuthentication(HeaderAuthHandler.Scheme).AddScheme<AuthenticationSchemeOptions, HeaderAuthHandler>(HeaderAuthHandler.Scheme, _ => { });
        builder.Services.AddAuthorization();
        builder.Services.AddScoped<IExportRowSource>(_ => new FakeExportSource(rows));
        builder.Services.AddScoped<IReportDataSource>(_ => FakeReportDataSource.FixedCodes(rows));
        builder.Services.AddSingleton<IReportTemplateStore, InMemoryTemplateStore>();
        builder.Services.AddCustomReports();
        var app = builder.Build();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapCustomReports();
        await app.StartAsync();
        var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
        return (app, new HttpClient { BaseAddress = new Uri(address) });
    }

    private static HttpRequestMessage Request(HttpMethod method, string path, object? body = null, int? userId = 1)
    {
        var message = new HttpRequestMessage(method, path);
        if (body is not null) message.Content = JsonContent.Create(body);
        if (userId is not null)
        {
            message.Headers.Add("X-Test-User", Uri.EscapeDataString($"Usuaria {userId}"));
            message.Headers.Add("X-Test-UserId", userId.ToString());
        }
        return message;
    }

    private static readonly object Definition = new { layer = "CodigosFijos", columns = new[] { "CodFijo", "Nombre" }, groupBy = "Estado", format = "xlsx" };

    private static async Task<JsonElement> Json(HttpResponseMessage response) => (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

    [Theory]
    [InlineData("GET", "/api/reports/fields")]
    [InlineData("POST", "/api/reports/preview")]
    [InlineData("POST", "/api/reports/export")]
    [InlineData("GET", "/api/report-templates")]
    public async Task Every_report_endpoint_requires_a_session(string method, string path)
    {
        var (app, client) = await StartAsync(5);
        await using var _ = app;
        var response = await client.SendAsync(Request(new HttpMethod(method), path, method == "POST" ? Definition : null, userId: null));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Fields_describe_types_operators_and_options()
    {
        var (app, client) = await StartAsync(5);
        await using var _ = app;
        var data = await Json(await client.SendAsync(Request(HttpMethod.Get, "/api/reports/fields")));
        var fixedCodes = data.GetProperty("layers").EnumerateArray().Single(l => l.GetProperty("id").GetString() == "CodigosFijos");
        var state = fixedCodes.GetProperty("fields").EnumerateArray().Single(f => f.GetProperty("key").GetString() == "Estado");
        Assert.Equal("integer", state.GetProperty("filterKind").GetString());
        Assert.Equal(5, state.GetProperty("options").GetArrayLength());
        Assert.True(state.GetProperty("groupable").GetBoolean());
        var date = fixedCodes.GetProperty("fields").EnumerateArray().Single(f => f.GetProperty("key").GetString() == "FechaCambioEstado");
        Assert.Equal(["between", "gte", "lte"], date.GetProperty("operators").EnumerateArray().Select(o => o.GetString()));
    }

    [Fact]
    public async Task Preview_returns_rows_total_and_groups()
    {
        var (app, client) = await StartAsync(60);
        await using var _ = app;
        var data = await Json(await client.SendAsync(Request(HttpMethod.Post, "/api/reports/preview", Definition)));
        Assert.Equal(60, data.GetProperty("total").GetInt64());
        Assert.Equal(50, data.GetProperty("rows").GetArrayLength());
        Assert.Equal(3, data.GetProperty("groups").GetArrayLength());
    }

    [Fact]
    public async Task Invalid_reports_are_explained_to_the_user()
    {
        var (app, client) = await StartAsync(5);
        await using var _ = app;
        var response = await client.SendAsync(Request(HttpMethod.Post, "/api/reports/preview", new { layer = "CodigosFijos", filters = new[] { new { field = "CodFijo", @operator = "contains", value = "1" } } }));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Código fijo", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Small_reports_download_immediately()
    {
        var (app, client) = await StartAsync(5);
        await using var _ = app;
        var response = await client.SendAsync(Request(HttpMethod.Post, "/api/reports/export", Definition));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Matches(@"^reporte_codigos_fijos_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$", response.Content.Headers.ContentDisposition?.FileName?.Trim('"'));
    }

    [Fact]
    public async Task Large_reports_run_in_the_background_and_only_their_owner_can_download_them()
    {
        var (app, client) = await StartAsync(rows: 30, asyncThreshold: 10);
        await using var _ = app;
        var accepted = await client.SendAsync(Request(HttpMethod.Post, "/api/reports/export", Definition, userId: 7));
        Assert.Equal(HttpStatusCode.Accepted, accepted.StatusCode);
        var jobId = (await Json(accepted)).GetProperty("job").GetProperty("id").GetString()!;

        string status = "";
        for (var attempt = 0; attempt < 100 && status != "completed"; attempt++)
        {
            status = (await Json(await client.SendAsync(Request(HttpMethod.Get, $"/api/reports/jobs/{jobId}", userId: 7)))).GetProperty("job").GetProperty("status").GetString()!;
            if (status == "failed") Assert.Fail("The background report failed.");
            if (status != "completed") await Task.Delay(100);
        }
        Assert.Equal("completed", status);

        Assert.Equal(HttpStatusCode.NotFound, (await client.SendAsync(Request(HttpMethod.Get, $"/api/reports/jobs/{jobId}", userId: 8))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.SendAsync(Request(HttpMethod.Get, $"/api/reports/jobs/{jobId}/file", userId: 8))).StatusCode);
        var file = await client.SendAsync(Request(HttpMethod.Get, $"/api/reports/jobs/{jobId}/file", userId: 7));
        Assert.Equal(HttpStatusCode.OK, file.StatusCode);
        using var workbook = new ClosedXML.Excel.XLWorkbook(await file.Content.ReadAsStreamAsync());
        Assert.Equal("Total: 30 registros", workbook.Worksheet("Datos").LastRowUsed()!.Cell(1).GetString());
    }

    [Fact]
    public async Task Reports_above_the_hard_limit_are_rejected_before_queueing()
    {
        var (app, client) = await StartAsync(rows: 1_001, asyncThreshold: 10);
        await using var _ = app;
        var response = await client.SendAsync(Request(HttpMethod.Post, "/api/reports/export", Definition));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task Templates_are_private_to_each_user()
    {
        var (app, client) = await StartAsync(5);
        await using var _ = app;
        var created = await client.SendAsync(Request(HttpMethod.Post, "/api/report-templates", new { name = "Cortes por estado", definition = Definition }, userId: 1));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var template = (await Json(created)).GetProperty("template");
        var id = template.GetProperty("id").GetInt32();
        Assert.Equal(["Estado", "CodFijo", "Nombre"], template.GetProperty("definition").GetProperty("columns").EnumerateArray().Select(c => c.GetString()));

        Assert.Equal(0, (await Json(await client.SendAsync(Request(HttpMethod.Get, "/api/report-templates", userId: 2)))).GetProperty("templates").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await client.SendAsync(Request(HttpMethod.Get, $"/api/report-templates/{id}", userId: 2))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.SendAsync(Request(HttpMethod.Put, $"/api/report-templates/{id}", new { name = "Robada", definition = Definition }, userId: 2))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.SendAsync(Request(HttpMethod.Delete, $"/api/report-templates/{id}", userId: 2))).StatusCode);

        var updated = await client.SendAsync(Request(HttpMethod.Put, $"/api/report-templates/{id}", new { name = "Cortes por estado (PDF)", definition = new { layer = "CodigosFijos", format = "pdf" } }, userId: 1));
        Assert.Equal("Cortes por estado (PDF)", (await Json(updated)).GetProperty("template").GetProperty("name").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(Request(HttpMethod.Delete, $"/api/report-templates/{id}", userId: 1))).StatusCode);
        Assert.Equal(0, (await Json(await client.SendAsync(Request(HttpMethod.Get, "/api/report-templates", userId: 1)))).GetProperty("templates").GetArrayLength());
    }

    [Fact]
    public async Task Templates_reject_duplicate_names_and_invalid_definitions()
    {
        var (app, client) = await StartAsync(5);
        await using var _ = app;
        await client.SendAsync(Request(HttpMethod.Post, "/api/report-templates", new { name = "Mía", definition = Definition }));
        Assert.Equal(HttpStatusCode.Conflict, (await client.SendAsync(Request(HttpMethod.Post, "/api/report-templates", new { name = "Mía", definition = Definition }))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.SendAsync(Request(HttpMethod.Post, "/api/report-templates", new { name = "", definition = Definition }))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.SendAsync(Request(HttpMethod.Post, "/api/report-templates", new { name = "Mala", definition = new { layer = "CodigosFijos", columns = new[] { "PasswordHash" } } }))).StatusCode);
    }
}
