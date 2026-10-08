import { apiFetch } from "./auth";
import { fileNameFromDisposition, type ExportedFile } from "./exports";
import type { LayerId } from "./layers";

export type FieldKind = "text" | "integer" | "decimal" | "coordinate" | "currency" | "date";
export type FilterOperator = "contains" | "equals" | "startsWith" | "in" | "gte" | "lte" | "between";

export interface ReportField {
  key: string;
  label: string;
  kind: FieldKind;
  filterKind: FieldKind;
  operators: FilterOperator[];
  options: Array<{ value: string; label: string }> | null;
  groupable: boolean;
}
export interface ReportLayer { id: LayerId; title: string; defaultColumns: string[]; fields: ReportField[] }

export interface ReportFilter { field: string; operator: FilterOperator; value?: string; valueTo?: string; values?: string[] }
export interface ReportSort { field: string; direction: "asc" | "desc" }
export interface ReportDefinition {
  layer: LayerId;
  columns: string[];
  q?: string;
  filters: ReportFilter[];
  groupBy?: string | null;
  sort: ReportSort[];
  format: "xlsx" | "pdf";
  orientation: "auto" | "portrait" | "landscape";
  title?: string | null;
  includeParameters: boolean;
}

export interface ReportPreview {
  columns: Array<{ key: string; label: string; kind: string }>;
  rows: string[][];
  total: number;
  groupBy: string | null;
  groups: Array<{ label: string; count: number }>;
  maxRows: number;
  asyncThreshold: number;
}

export interface ReportTemplate { id: number; name: string; layer: LayerId; definition: ReportDefinition; createdAt: string; updatedAt: string }

export type JobStatus = "queued" | "running" | "completed" | "failed";
export interface ReportJob { id: string; status: JobStatus; title: string; layer: LayerId; format: "xlsx" | "pdf"; fileName: string | null; error: string | null; createdAt: string; completedAt: string | null }

/** Immediate download, or a background job when the report is large. */
export type ReportExportResult = { kind: "file"; file: ExportedFile } | { kind: "job"; job: ReportJob; total: number };

export const operatorLabels: Record<FilterOperator, string> = {
  contains: "contiene", equals: "es igual a", startsWith: "empieza con", in: "es uno de", gte: "desde", lte: "hasta", between: "entre"
};

async function problemMessage(response: Response, fallback: string) {
  if (response.status === 401) return "Tu sesión expiró. Volvé a iniciar sesión.";
  try { const problem = await response.json(); return problem.detail || fallback; } catch { return fallback; }
}

async function send<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) throw new Error(await problemMessage(response, fallback));
  if (response.status === 204) return undefined as T;
  return (await response.json() as { data: T }).data;
}

const post = (body: unknown, method = "POST"): RequestInit => ({ method, body: JSON.stringify(body) });

export const getReportFields = async () => (await send<{ layers: ReportLayer[] }>("/api/reports/fields", {}, "No se pudieron cargar los campos del reporte.")).layers;

export const previewReport = (definition: ReportDefinition) =>
  send<ReportPreview>("/api/reports/preview", post(definition), "No se pudo generar la vista previa.");

export async function exportReport(definition: ReportDefinition): Promise<ReportExportResult> {
  const response = await apiFetch("/api/reports/export", post(definition));
  if (!response.ok) throw new Error(await problemMessage(response, "No se pudo generar el reporte."));
  if (response.status === 202) {
    const { job, total } = (await response.json() as { data: { job: ReportJob; total: number } }).data;
    return { kind: "job", job, total };
  }
  const fileName = fileNameFromDisposition(response.headers.get("Content-Disposition")) ?? `reporte.${definition.format}`;
  return { kind: "file", file: { blob: await response.blob(), fileName } };
}

export const getReportJob = async (id: string) => (await send<{ job: ReportJob }>(`/api/reports/jobs/${encodeURIComponent(id)}`, {}, "No se pudo consultar el reporte.")).job;

export async function downloadReportJob(job: ReportJob): Promise<ExportedFile> {
  const response = await apiFetch(`/api/reports/jobs/${encodeURIComponent(job.id)}/file`);
  if (!response.ok) throw new Error(await problemMessage(response, "No se pudo descargar el reporte."));
  return { blob: await response.blob(), fileName: fileNameFromDisposition(response.headers.get("Content-Disposition")) ?? job.fileName ?? `reporte.${job.format}` };
}

export const listTemplates = async () => (await send<{ templates: ReportTemplate[] }>("/api/report-templates", {}, "No se pudieron cargar tus plantillas.")).templates;
export const createTemplate = async (name: string, definition: ReportDefinition) =>
  (await send<{ template: ReportTemplate }>("/api/report-templates", post({ name, definition }), "No se pudo guardar la plantilla.")).template;
export const updateTemplate = async (id: number, name: string, definition: ReportDefinition) =>
  (await send<{ template: ReportTemplate }>(`/api/report-templates/${id}`, post({ name, definition }, "PUT"), "No se pudo actualizar la plantilla.")).template;
export const deleteTemplate = (id: number) => send<void>(`/api/report-templates/${id}`, { method: "DELETE" }, "No se pudo eliminar la plantilla.");

/** Fills in defaults so a template saved with an older/partial definition opens cleanly in the builder. */
export function completeDefinition(definition: Partial<ReportDefinition> & { layer: LayerId }, layer?: ReportLayer): ReportDefinition {
  return {
    layer: definition.layer,
    columns: definition.columns?.length ? definition.columns : layer?.defaultColumns ?? [],
    q: definition.q ?? "",
    filters: definition.filters ?? [],
    groupBy: definition.groupBy ?? null,
    sort: definition.sort ?? [],
    format: definition.format ?? "xlsx",
    orientation: definition.orientation ?? "auto",
    title: definition.title ?? "",
    includeParameters: definition.includeParameters ?? true
  };
}
