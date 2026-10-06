import { apiFetch } from "./auth";
import type { LayerId } from "./layers";

export type ExportFormat = "xlsx" | "pdf";
export type ExportScope = "page" | "all";

/** Mirrors what the query screen shows, so the file contains exactly the visible results. */
export interface ExportRequest {
  layer: LayerId;
  format: ExportFormat;
  scope: ExportScope;
  q?: string;
  filters?: Record<string, string>;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  columns: string[];
  page: number;
  pageSize: number;
  orientation?: "auto" | "portrait" | "landscape";
}

export interface ExportedFile { blob: Blob; fileName: string }

const fallbackName = (request: ExportRequest) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const slug = request.layer.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  return `reporte_${slug}_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.${request.format}`;
};

export function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) return decodeURIComponent(encoded[1]);
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}

export async function exportResults(request: ExportRequest): Promise<ExportedFile> {
  const filters = Object.fromEntries(Object.entries(request.filters ?? {}).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()]));
  const response = await apiFetch("/api/exports", { method: "POST", body: JSON.stringify({ ...request, q: request.q?.trim() || undefined, filters }) });
  if (!response.ok) {
    let message = response.status === 401 ? "Tu sesión expiró. Volvé a iniciar sesión para exportar." : "No se pudo generar el archivo. Intentá nuevamente.";
    try { const problem = await response.json(); if (response.status !== 401 && problem.detail) message = problem.detail; } catch { /* ProblemDetails body is optional. */ }
    throw new Error(message);
  }
  return { blob: await response.blob(), fileName: fileNameFromDisposition(response.headers.get("Content-Disposition")) ?? fallbackName(request) };
}

export function saveFile({ blob, fileName }: ExportedFile) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
