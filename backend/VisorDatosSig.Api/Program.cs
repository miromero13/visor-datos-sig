using VisorDatosSig.Api;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<ISqlConnectionProbe, SqlServerConnectionProbe>();
var app = builder.Build();

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
