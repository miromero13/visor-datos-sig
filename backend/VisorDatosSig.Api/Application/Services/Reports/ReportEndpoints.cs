using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace VisorDatosSig.Api;

public static class ReportEndpoints
{
    public static IServiceCollection AddCustomReports(this IServiceCollection services)
    {
        services.AddReportExports();
        services.TryAddScoped<IReportDataSource, SqlReportDataSource>();
        services.TryAddScoped<IReportTemplateStore, SqlReportTemplateStore>();
        services.AddScoped<ReportService>();
        services.AddScoped<ReportTemplateService>();
        services.AddSingleton<ReportJobQueue>();
        services.AddHostedService<ReportJobWorker>();
        return services;
    }

    public static IEndpointRouteBuilder MapCustomReports(this IEndpointRouteBuilder app)
    {
        var reports = app.MapGroup("/api/reports").RequireAuthorization();

        reports.MapGet("/fields", () => Results.Ok(new
        {
            data = new
            {
                layers = ExportColumnCatalog.AllLayers.Select(layer => new
                {
                    id = layer.Key,
                    title = layer.Title,
                    defaultColumns = ExportColumnCatalog.DefaultColumns(layer.Key).Select(c => c.Key),
                    fields = layer.Columns.Select(c => new
                    {
                        key = c.Key,
                        label = c.Label,
                        kind = c.Kind.ToString().ToLowerInvariant(),
                        filterKind = c.FilterKind.ToString().ToLowerInvariant(),
                        operators = ReportDefinitionValidator.OperatorsFor(c.FilterKind).Select(ReportDefinitionValidator.OperatorKey),
                        options = c.Options,
                        groupable = c.Groupable
                    })
                })
            },
            meta = new { maxColumns = ReportDefinitionValidator.MaxColumns, maxFilters = ReportDefinitionValidator.MaxFilters, maxSorts = ReportDefinitionValidator.MaxSorts }
        }));

        reports.MapPost("/preview", (ReportDefinition definition, ReportService service, ILogger<ReportService> logger, CancellationToken cancellationToken) =>
            Handle(logger, async () => Results.Ok(new { data = await service.PreviewAsync(definition, cancellationToken) })));

        reports.MapPost("/export", (ReportDefinition definition, ClaimsPrincipal principal, ReportService service, ReportJobQueue queue, ILogger<ReportService> logger, CancellationToken cancellationToken) =>
            Handle(logger, async () =>
            {
                if (UserId(principal) is not { } userId) return Results.Unauthorized();
                var report = ReportDefinitionValidator.Validate(definition);
                var total = await service.CheckSizeAsync(report, cancellationToken);
                if (total > service.AsyncThreshold)
                {
                    var job = queue.Enqueue(userId, DisplayName(principal), report);
                    return Results.Accepted($"/api/reports/jobs/{job.Id}", new { data = new { job = job.ToResponse(), total } });
                }
                var file = await service.GenerateAsync(report, DisplayName(principal), cancellationToken);
                logger.LogInformation("Custom report exported. Layer={Layer} Format={Format} User={UserId} File={File}", report.Layer.Key, report.Format, userId, file.FileName);
                return Results.File(file.Content, file.ContentType, file.FileName);
            }));

        reports.MapGet("/jobs", (ClaimsPrincipal principal, ReportJobQueue queue) =>
            UserId(principal) is { } userId ? Results.Ok(new { data = new { jobs = queue.ForUser(userId).Select(j => j.ToResponse()) } }) : Results.Unauthorized());

        reports.MapGet("/jobs/{id}", (string id, ClaimsPrincipal principal, ReportJobQueue queue) =>
            UserId(principal) is { } userId && queue.Get(id, userId) is { } job ? Results.Ok(new { data = new { job = job.ToResponse() } }) : JobNotFound());

        reports.MapGet("/jobs/{id}/file", (string id, ClaimsPrincipal principal, ReportJobQueue queue) =>
        {
            if (UserId(principal) is not { } userId || queue.Get(id, userId) is not { } job) return JobNotFound();
            if (job.Status != ReportJobStatus.Completed || job.FilePath is null || !File.Exists(job.FilePath))
                return Results.Problem(statusCode: 409, title: "Report not ready", detail: "El reporte todavía no está listo.");
            return Results.File(job.FilePath, job.ContentType, job.FileName);
        });

        var templates = app.MapGroup("/api/report-templates").RequireAuthorization();

        templates.MapGet("/", (ClaimsPrincipal principal, ReportTemplateService service, ILogger<ReportTemplateService> logger, CancellationToken cancellationToken) =>
            Handle(logger, async () => UserId(principal) is { } userId
                ? Results.Ok(new { data = new { templates = await service.ListAsync(userId, cancellationToken) } })
                : Results.Unauthorized()));

        templates.MapGet("/{id:int}", (int id, ClaimsPrincipal principal, ReportTemplateService service, ILogger<ReportTemplateService> logger, CancellationToken cancellationToken) =>
            Handle(logger, async () => UserId(principal) is { } userId && await service.GetAsync(id, userId, cancellationToken) is { } template
                ? Results.Ok(new { data = new { template } })
                : TemplateNotFound()));

        templates.MapPost("/", (SaveReportTemplateRequest request, ClaimsPrincipal principal, ReportTemplateService service, ILogger<ReportTemplateService> logger, CancellationToken cancellationToken) =>
            Handle(logger, async () =>
            {
                if (UserId(principal) is not { } userId) return Results.Unauthorized();
                var template = await service.CreateAsync(userId, request, cancellationToken);
                return Results.Created($"/api/report-templates/{template.Id}", new { data = new { template } });
            }));

        templates.MapPut("/{id:int}", (int id, SaveReportTemplateRequest request, ClaimsPrincipal principal, ReportTemplateService service, ILogger<ReportTemplateService> logger, CancellationToken cancellationToken) =>
            Handle(logger, async () => UserId(principal) is { } userId && await service.UpdateAsync(id, userId, request, cancellationToken) is { } template
                ? Results.Ok(new { data = new { template } })
                : TemplateNotFound()));

        templates.MapDelete("/{id:int}", (int id, ClaimsPrincipal principal, ReportTemplateService service, ILogger<ReportTemplateService> logger, CancellationToken cancellationToken) =>
            Handle(logger, async () => UserId(principal) is { } userId && await service.DeleteAsync(id, userId, cancellationToken)
                ? Results.NoContent()
                : TemplateNotFound()));

        return app;
    }

    public static int? UserId(ClaimsPrincipal principal) =>
        int.TryParse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id) ? id : null;

    private static string DisplayName(ClaimsPrincipal principal) =>
        principal.FindFirstValue("display_name") ?? principal.FindFirstValue("login") ?? "Usuario";

    private static IResult TemplateNotFound() => Results.Problem(statusCode: 404, title: "Template not found", detail: "La plantilla no existe o no te pertenece.");
    private static IResult JobNotFound() => Results.Problem(statusCode: 404, title: "Report job not found", detail: "El reporte no existe o ya expiró.");

    private static async Task<IResult> Handle(ILogger logger, Func<Task<IResult>> action)
    {
        try { return await action(); }
        catch (KeyNotFoundException ex) { return Results.Problem(statusCode: 404, title: "Layer not found", detail: ex.Message); }
        catch (ExportTooLargeException ex) { return Results.Problem(statusCode: 422, title: "Report too large", detail: ex.Message); }
        catch (DuplicateTemplateNameException ex) { return Results.Problem(statusCode: 409, title: "Duplicate template name", detail: ex.Message); }
        catch (TemplateLimitException ex) { return Results.Problem(statusCode: 409, title: "Template limit reached", detail: ex.Message); }
        catch (TooManyReportJobsException ex) { return Results.Problem(statusCode: 429, title: "Too many report jobs", detail: ex.Message); }
        catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "Invalid report", detail: ex.Message); }
        catch (SqlException exception)
        {
            logger.LogError(exception, "Report query failed in SQL Server.");
            return Results.Problem(statusCode: 503, title: "Report data unavailable", detail: "No se pudieron consultar los datos del reporte.");
        }
    }
}
