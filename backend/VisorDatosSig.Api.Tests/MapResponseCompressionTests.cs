using System.IO.Compression;
using System.Net;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.DependencyInjection;
using VisorDatosSig.Api;
using Xunit;

public sealed class MapResponseCompressionTests
{
    [Theory]
    [InlineData("gzip")]
    [InlineData("br")]
    public async Task CompressesOnlyLayerResponses(string encoding)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseKestrel().UseUrls("http://127.0.0.1:0");
        builder.Services.AddMapResponseCompression();
        await using var app = builder.Build();
        app.UseMapResponseCompression();
        const string json = "{\"features\":[";
        var payload = json + string.Join(',', Enumerable.Repeat("{\"id\":42,\"geometry\":{\"type\":\"LineString\",\"coordinates\":[[1.123456,2.654321],[3.123456,4.654321]]},\"properties\":{\"name\":\"same repeated map feature\"}}", 100)) + "]}";
        app.MapGet("/api/layers/demo", () => Results.Json(System.Text.Json.JsonDocument.Parse(payload).RootElement));
        app.MapGet("/api/auth/secret", () => Results.Json(new { secret = payload }));
        app.MapGet("/api/other", () => Results.Json(new { value = payload }));
        app.MapGet("/api/layers-other/demo", () => Results.Json(new { value = payload }));
        app.MapGet("/api/layers/text", () => Results.Text(payload, "text/plain"));
        await app.StartAsync();
        try
        {
            var address = app.Services.GetRequiredService<Microsoft.AspNetCore.Hosting.Server.IServer>().Features.Get<Microsoft.AspNetCore.Hosting.Server.Features.IServerAddressesFeature>()!.Addresses.Single();
            using var handler = new HttpClientHandler { AutomaticDecompression = DecompressionMethods.None };
            using var client = new HttpClient(handler);
            using var request = new HttpRequestMessage(HttpMethod.Get, address + "/api/layers/demo");
            request.Headers.TryAddWithoutValidation("Accept-Encoding", encoding);
            using var response = await client.SendAsync(request);
            Assert.Equal(encoding, response.Content.Headers.ContentEncoding.Single());
            Assert.Contains("Accept-Encoding", response.Headers.Vary);
            var bytes = await response.Content.ReadAsByteArrayAsync();
            Assert.True(bytes.Length < Encoding.UTF8.GetByteCount(payload));
            await using var input = new MemoryStream(bytes);
            await using Stream decompressor = encoding == "br" ? new BrotliStream(input, CompressionMode.Decompress) : new GZipStream(input, CompressionMode.Decompress);
            using var output = new MemoryStream(); await decompressor.CopyToAsync(output);
            Assert.Equal(payload, Encoding.UTF8.GetString(output.ToArray()));
            foreach (var path in new[] { "/api/auth/secret", "/api/other", "/api/layers-other/demo", "/api/layers/text" })
            {
                using var excluded = new HttpRequestMessage(HttpMethod.Get, address + path);
                excluded.Headers.TryAddWithoutValidation("Accept-Encoding", encoding);
                using var excludedResponse = await client.SendAsync(excluded);
                Assert.Empty(excludedResponse.Content.Headers.ContentEncoding);
            }
            foreach (var accept in new[] { (string?)null, "zstd" })
            {
                using var plain = new HttpRequestMessage(HttpMethod.Get, address + "/api/layers/demo");
                if (accept is not null) plain.Headers.TryAddWithoutValidation("Accept-Encoding", accept);
                using var plainResponse = await client.SendAsync(plain);
                Assert.Empty(plainResponse.Content.Headers.ContentEncoding);
                Assert.Equal(payload, await plainResponse.Content.ReadAsStringAsync());
            }
        }
        finally { await app.StopAsync(); }
    }

    [Fact]
    public async Task AuthorizationRunsBeforeCompressionAndAuthenticatedCookieCanReadLayer()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseKestrel().UseUrls("http://127.0.0.1:0");
        builder.Services.AddMapResponseCompression();
        builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
        {
            options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
        });
        builder.Services.AddAuthorization(options => options.DefaultPolicy = new AuthorizationPolicyBuilder(CookieAuthenticationDefaults.AuthenticationScheme).RequireAuthenticatedUser().Build());
        await using var app = builder.Build();
        app.UseRouting();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseMapResponseCompression();
        const string payload = "{\"features\":[{\"id\":7,\"geometry\":{\"type\":\"Point\",\"coordinates\":[1,2]},\"properties\":{\"name\":\"test\"}}]}";
        app.MapPost("/test-login", async context =>
        {
            var identity = new ClaimsIdentity([new Claim(ClaimTypes.Name, "test")], CookieAuthenticationDefaults.AuthenticationScheme);
            await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));
        }).AllowAnonymous();
        app.MapGet("/api/layers/protected", () => Results.Json(System.Text.Json.JsonDocument.Parse(payload).RootElement)).RequireAuthorization(new AuthorizeAttribute());
        await app.StartAsync();
        try
        {
            var address = app.Services.GetRequiredService<Microsoft.AspNetCore.Hosting.Server.IServer>().Features.Get<Microsoft.AspNetCore.Hosting.Server.Features.IServerAddressesFeature>()!.Addresses.Single();
            foreach (var encoding in new[] { "gzip", "br" })
            {
                using var handler = new HttpClientHandler { AutomaticDecompression = DecompressionMethods.None, AllowAutoRedirect = false, UseCookies = true };
                using var client = new HttpClient(handler);
                using var deniedRequest = new HttpRequestMessage(HttpMethod.Get, address + "/api/layers/protected");
                deniedRequest.Headers.TryAddWithoutValidation("Accept-Encoding", encoding);
                using var denied = await client.SendAsync(deniedRequest);
                Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
                Assert.Empty(denied.Content.Headers.ContentEncoding);
                Assert.DoesNotContain("features", await denied.Content.ReadAsStringAsync());
                using var login = await client.PostAsync(address + "/test-login", null);
                Assert.True(login.Headers.TryGetValues("Set-Cookie", out var cookies) && cookies.Any(value => value.StartsWith(".AspNetCore.Cookies=")));
                using var allowedRequest = new HttpRequestMessage(HttpMethod.Get, address + "/api/layers/protected");
                allowedRequest.Headers.TryAddWithoutValidation("Accept-Encoding", encoding);
                using var allowed = await client.SendAsync(allowedRequest);
                Assert.Equal(encoding, allowed.Content.Headers.ContentEncoding.Single());
                var compressed = await allowed.Content.ReadAsByteArrayAsync();
                await using var input = new MemoryStream(compressed);
                await using Stream decompressor = encoding == "br" ? new BrotliStream(input, CompressionMode.Decompress) : new GZipStream(input, CompressionMode.Decompress);
                using var decoded = new MemoryStream(); await decompressor.CopyToAsync(decoded);
                Assert.Equal(payload, Encoding.UTF8.GetString(decoded.ToArray()));
            }
        }
        finally { await app.StopAsync(); }
    }

    [Fact]
    public void HttpsCompressionIsEnabledAndProvidersAreFastest()
    {
        var services = new ServiceCollection();
        services.AddLogging(); services.AddMapResponseCompression();
        using var provider = services.BuildServiceProvider();
        Assert.True(provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<ResponseCompressionOptions>>().Value.EnableForHttps);
        Assert.Equal(CompressionLevel.Fastest, provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<BrotliCompressionProviderOptions>>().Value.Level);
        Assert.Equal(CompressionLevel.Fastest, provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<GzipCompressionProviderOptions>>().Value.Level);
    }
}
