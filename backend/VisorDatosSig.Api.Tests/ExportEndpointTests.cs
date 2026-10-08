using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace VisorDatosSig.Api.Tests;

internal sealed class HeaderAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string Scheme = "Test";
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("X-Test-User", out var name)) return Task.FromResult(AuthenticateResult.NoResult());
        var userId = Request.Headers.TryGetValue("X-Test-UserId", out var id) ? id.ToString() : "1";
        var identity = new ClaimsIdentity([new Claim("sub", userId), new Claim("display_name", Uri.UnescapeDataString(name.ToString())), new Claim(ClaimTypes.Role, "Consultor")], Scheme);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme)));
    }
}

public sealed class ExportEndpointTests
{
    private static async Task<(WebApplication App, HttpClient Client)> StartAsync(long rows)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseKestrel().UseUrls("http://127.0.0.1:0");
        builder.Configuration["Reports:MaxRows"] = "100";
        builder.Services.AddAuthentication(HeaderAuthHandler.Scheme).AddScheme<AuthenticationSchemeOptions, HeaderAuthHandler>(HeaderAuthHandler.Scheme, _ => { });
        builder.Services.AddAuthorization();
        builder.Services.AddScoped<IExportRowSource>(_ => new FakeExportSource(rows));
        builder.Services.AddReportExports();
        var app = builder.Build();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapReportExports();
        await app.StartAsync();
        var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
        return (app, new HttpClient { BaseAddress = new Uri(address) });
    }

    private static HttpRequestMessage Post(object body, string? user = "Lucía Peña")
    {
        var message = new HttpRequestMessage(HttpMethod.Post, "/api/exports") { Content = JsonContent.Create(body) };
        if (user is not null) message.Headers.Add("X-Test-User", Uri.EscapeDataString(user));
        return message;
    }

    [Fact]
    public async Task Requires_an_authenticated_user()
    {
        var (app, client) = await StartAsync(5);
        await using var _ = app;
        var response = await client.SendAsync(Post(new { layer = "Lotes", format = "xlsx" }, user: null));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Returns_the_file_with_a_descriptive_name()
    {
        var (app, client) = await StartAsync(5);
        await using var _ = app;
        var response = await client.SendAsync(Post(new { layer = "Lotes", format = "xlsx", scope = "all", columns = new[] { "NroLote", "IdManzana" } }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", response.Content.Headers.ContentType?.MediaType);
        Assert.Matches(@"^reporte_lotes_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$", response.Content.Headers.ContentDisposition?.FileName?.Trim('"'));
    }

    [Theory]
    [InlineData("Usuarios", "pdf", "page", HttpStatusCode.NotFound)]
    [InlineData("Lotes", "docx", "page", HttpStatusCode.BadRequest)]
    [InlineData("Lotes", "pdf", "all", HttpStatusCode.UnprocessableEntity)]
    public async Task Maps_invalid_requests_to_problem_details(string layer, string format, string scope, HttpStatusCode expected)
    {
        var (app, client) = await StartAsync(rows: 101);
        await using var _ = app;
        var response = await client.SendAsync(Post(new { layer, format, scope }));
        Assert.Equal(expected, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Rejects_fields_outside_the_allowlist()
    {
        var (app, client) = await StartAsync(5);
        await using var _ = app;
        var response = await client.SendAsync(Post(new { layer = "Lotes", format = "pdf", filters = new Dictionary<string, string> { ["Geom"] = "x" } }));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
