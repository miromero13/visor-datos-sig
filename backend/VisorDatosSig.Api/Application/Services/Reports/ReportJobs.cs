using System.Collections.Concurrent;
using System.Threading.Channels;

namespace VisorDatosSig.Api;

public enum ReportJobStatus { Queued, Running, Completed, Failed }

public sealed class ReportJob(string id, int userId, string generatedBy, ValidatedReport report, DateTimeOffset createdAt)
{
    public string Id { get; } = id;
    public int UserId { get; } = userId;
    public string GeneratedBy { get; } = generatedBy;
    public ValidatedReport Report { get; } = report;
    public DateTimeOffset CreatedAt { get; } = createdAt;
    public ReportJobStatus Status { get; set; } = ReportJobStatus.Queued;
    public DateTimeOffset? CompletedAt { get; set; }
    public string? FileName { get; set; }
    public string? ContentType { get; set; }
    public string? FilePath { get; set; }
    public string? Error { get; set; }

    public object ToResponse() => new
    {
        id = Id,
        status = Status.ToString().ToLowerInvariant(),
        title = Report.Title,
        layer = Report.Layer.Key,
        format = Report.Format == ExportFormat.Pdf ? "pdf" : "xlsx",
        fileName = FileName,
        error = Error,
        createdAt = CreatedAt,
        completedAt = CompletedAt
    };
}

public sealed class TooManyReportJobsException(int max) : Exception($"Ya tenés {max} reportes en preparación. Esperá a que terminen para pedir otro.");

/// <summary>
/// In-memory registry and queue of background report jobs. Jobs and their files live only while the API runs and are
/// removed after <c>Reports:JobRetentionMinutes</c>. Lookups always require the owner's user id.
/// </summary>
public sealed class ReportJobQueue(IConfiguration configuration, TimeProvider clock)
{
    private readonly ConcurrentDictionary<string, ReportJob> jobs = new();
    private readonly Channel<ReportJob> channel = Channel.CreateUnbounded<ReportJob>(new UnboundedChannelOptions { SingleReader = true });
    public int MaxActivePerUser => configuration.GetValue("Reports:MaxActiveJobsPerUser", 3);
    public TimeSpan Retention => TimeSpan.FromMinutes(configuration.GetValue("Reports:JobRetentionMinutes", 60));
    public string Directory { get; } = Path.Combine(configuration["Reports:JobDirectory"] ?? Path.GetTempPath(), "visordatossig-reports");

    public ChannelReader<ReportJob> Reader => channel.Reader;

    public ReportJob Enqueue(int userId, string generatedBy, ValidatedReport report)
    {
        var active = jobs.Values.Count(j => j.UserId == userId && j.Status is ReportJobStatus.Queued or ReportJobStatus.Running);
        if (active >= MaxActivePerUser) throw new TooManyReportJobsException(MaxActivePerUser);
        var job = new ReportJob(Guid.NewGuid().ToString("N"), userId, generatedBy, report, clock.GetUtcNow());
        jobs[job.Id] = job;
        channel.Writer.TryWrite(job);
        return job;
    }

    public ReportJob? Get(string id, int userId) => jobs.TryGetValue(id, out var job) && job.UserId == userId ? job : null;

    public IReadOnlyList<ReportJob> ForUser(int userId) => jobs.Values.Where(j => j.UserId == userId).OrderByDescending(j => j.CreatedAt).ToList();

    public void RemoveExpired()
    {
        var limit = clock.GetUtcNow() - Retention;
        foreach (var job in jobs.Values.Where(j => j.Status is ReportJobStatus.Completed or ReportJobStatus.Failed && (j.CompletedAt ?? j.CreatedAt) < limit).ToList())
        {
            if (!jobs.TryRemove(job.Id, out _)) continue;
            try { if (job.FilePath is not null) File.Delete(job.FilePath); }
            catch (IOException) { /* The file is retried on the next sweep only if the job still exists; temp folders are cleaned by the OS. */ }
        }
    }
}

/// <summary>Generates queued reports one at a time so large exports never compete with interactive requests for memory.</summary>
public sealed class ReportJobWorker(ReportJobQueue queue, IServiceScopeFactory scopes, TimeProvider clock, ILogger<ReportJobWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        System.IO.Directory.CreateDirectory(queue.Directory);
        using var sweep = new PeriodicTimer(TimeSpan.FromMinutes(5));
        var cleanup = Task.Run(async () => { while (await sweep.WaitForNextTickAsync(stoppingToken)) queue.RemoveExpired(); }, stoppingToken);
        try
        {
            await foreach (var job in queue.Reader.ReadAllAsync(stoppingToken)) await RunAsync(job, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
        await cleanup.ContinueWith(_ => { }, CancellationToken.None);
    }

    public async Task RunAsync(ReportJob job, CancellationToken cancellationToken)
    {
        job.Status = ReportJobStatus.Running;
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            var file = await scope.ServiceProvider.GetRequiredService<ReportService>().GenerateAsync(job.Report, job.GeneratedBy, cancellationToken);
            System.IO.Directory.CreateDirectory(queue.Directory);
            var path = Path.Combine(queue.Directory, job.Id + Path.GetExtension(file.FileName));
            await File.WriteAllBytesAsync(path, file.Content, cancellationToken);
            (job.FilePath, job.FileName, job.ContentType) = (path, file.FileName, file.ContentType);
            job.Status = ReportJobStatus.Completed;
            logger.LogInformation("Background report completed. Job={JobId} User={UserId} File={File}", job.Id, job.UserId, file.FileName);
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            job.Error = exception is ExportTooLargeException or ArgumentException ? exception.Message : "No se pudo generar el reporte. Intentá nuevamente.";
            job.Status = ReportJobStatus.Failed;
            logger.LogError(exception, "Background report failed. Job={JobId} User={UserId}", job.Id, job.UserId);
        }
        finally { job.CompletedAt = clock.GetUtcNow(); }
    }
}
