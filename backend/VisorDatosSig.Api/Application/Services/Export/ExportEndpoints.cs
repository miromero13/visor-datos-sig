using System.Security.Claims;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace VisorDatosSig.Api;

public static class ExportEndpoints
{
    public static IServiceCollection AddReportExports(this IServiceCollection services)
    {
        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<IReportWriter, ExcelReportWriter>();
        services.AddSingleton<IReportWriter, PdfReportWriter>();
        services.TryAddScoped<IExportRowSource>(sp => sp.GetRequiredService<SearchQueryService>());
        services.AddScoped<ExportService>();
        return services;
    }

    public static IEndpointRouteBuilder MapReportExports(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/exports", async (ExportRequest request, ClaimsPrincipal principal, ExportService exports, ILogger<ExportService> logger, CancellationToken cancellationToken) =>
        {
            var user = principal.FindFirstValue("display_name") ?? principal.FindFirstValue("login") ?? principal.Identity?.Name ?? "Usuario";
            try
            {
                var file = await exports.ExportAsync(request, user, cancellationToken);
                logger.LogInformation("Report exported. Layer={Layer} Format={Format} Scope={Scope} User={User} File={File}", request.Layer, request.Format, request.Scope, user, file.FileName);
                return Results.File(file.Content, file.ContentType, file.FileName);
            }
            catch (KeyNotFoundException) { return Results.Problem(statusCode: 404, title: "Layer not found", detail: "La capa solicitada no existe."); }
            catch (ExportTooLargeException ex) { return Results.Problem(statusCode: 422, title: "Export too large", detail: ex.Message); }
            catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "Invalid export request", detail: ex.Message); }
            catch (SqlException exception)
            {
                logger.LogError(exception, "Export query failed in SQL Server. Layer={Layer}", request.Layer);
                return Results.Problem(statusCode: 503, title: "Export data unavailable", detail: "No se pudieron consultar los datos para exportar.");
            }
        }).RequireAuthorization();
        return app;
    }
}
