using System.Text.Json;

namespace VisorDatosSig.Api;

public sealed record ReportTemplate(int Id, string Name, string Layer, ReportDefinition Definition, DateTime CreatedAt, DateTime UpdatedAt);
public sealed record SaveReportTemplateRequest(string? Name, ReportDefinition? Definition);

public sealed class DuplicateTemplateNameException() : Exception("Ya tenés una plantilla con ese nombre.");
public sealed class TemplateLimitException(int max) : Exception($"Alcanzaste el máximo de {max} plantillas. Eliminá alguna para guardar otra.");

/// <summary>Persistence for report templates. Every operation is scoped to the owner: another user's id behaves as "not found".</summary>
public interface IReportTemplateStore
{
    Task<IReadOnlyList<ReportTemplate>> ListAsync(int userId, CancellationToken cancellationToken);
    Task<ReportTemplate?> GetAsync(int id, int userId, CancellationToken cancellationToken);
    Task<int> CountAsync(int userId, CancellationToken cancellationToken);
    Task<ReportTemplate> CreateAsync(int userId, string name, ReportDefinition definition, CancellationToken cancellationToken);
    Task<ReportTemplate?> UpdateAsync(int id, int userId, string name, ReportDefinition definition, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(int id, int userId, CancellationToken cancellationToken);
}

/// <summary>Validates templates before they are stored, so a saved template is always a report the user could run.</summary>
public sealed class ReportTemplateService(IReportTemplateStore store, IConfiguration configuration)
{
    public const int MaxNameLength = 100;
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public int MaxTemplatesPerUser => configuration.GetValue("Reports:MaxTemplatesPerUser", 50);

    public Task<IReadOnlyList<ReportTemplate>> ListAsync(int userId, CancellationToken cancellationToken) => store.ListAsync(userId, cancellationToken);
    public Task<ReportTemplate?> GetAsync(int id, int userId, CancellationToken cancellationToken) => store.GetAsync(id, userId, cancellationToken);
    public Task<bool> DeleteAsync(int id, int userId, CancellationToken cancellationToken) => store.DeleteAsync(id, userId, cancellationToken);

    public async Task<ReportTemplate> CreateAsync(int userId, SaveReportTemplateRequest request, CancellationToken cancellationToken)
    {
        var (name, definition) = Validate(request);
        if (await store.CountAsync(userId, cancellationToken) >= MaxTemplatesPerUser) throw new TemplateLimitException(MaxTemplatesPerUser);
        return await store.CreateAsync(userId, name, definition, cancellationToken);
    }

    public Task<ReportTemplate?> UpdateAsync(int id, int userId, SaveReportTemplateRequest request, CancellationToken cancellationToken)
    {
        var (name, definition) = Validate(request);
        return store.UpdateAsync(id, userId, name, definition, cancellationToken);
    }

    private static (string Name, ReportDefinition Definition) Validate(SaveReportTemplateRequest request)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name)) throw new ArgumentException("Escribí un nombre para la plantilla.");
        if (name.Length > MaxNameLength) throw new ArgumentException($"El nombre no puede superar {MaxNameLength} caracteres.");
        if (name.Any(char.IsControl)) throw new ArgumentException("El nombre contiene caracteres no válidos.");
        if (request.Definition is null) throw new ArgumentException("La plantilla no tiene configuración.");
        return (name, ReportDefinitionValidator.Validate(request.Definition).Normalized);
    }
}
