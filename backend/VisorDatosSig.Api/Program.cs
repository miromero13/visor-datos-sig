using Microsoft.AspNetCore.Mvc;
using VisorDatosSig.Api;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddAntiforgery();
builder.Services.AddSingleton<ISqlConnectionProbe, SqlServerConnectionProbe>();
var app = builder.Build();
app.UseAntiforgery();

app.MapPost("/api/shapefile-sources/analyze", ([FromForm] IFormFileCollection files) =>
{
    var layers = ShapefileSourceAnalyzer.Analyze(files.Select(file => file.FileName));
    return Results.Ok(new { layers });
}).DisableAntiforgery();

app.MapPost("/api/sql-connection/test", async (ISqlConnectionProbe probe, CancellationToken cancellationToken) =>
{
    var result = await probe.TestAsync(cancellationToken);
    var status = result.Status switch
    {
        ConnectionTestStatus.Connected => StatusCodes.Status200OK,
        ConnectionTestStatus.MissingConfiguration => StatusCodes.Status503ServiceUnavailable,
        _ => StatusCodes.Status502BadGateway
    };
    return Results.Json(new { status = result.Status.ToString(), message = result.Message }, statusCode: status);
});

app.Run();

public partial class Program;
