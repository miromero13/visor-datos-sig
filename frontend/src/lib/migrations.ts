import { apiFetch } from "@/lib/auth";

export type MigrationMode = "replace" | "append";
export interface MigrationLayerPreview {
  layer: string;
  table: string;
  records: number;
  sourceCrs: string;
  mappedFields: string[];
}
export interface MigrationValidation {
  valid: boolean;
  layers: MigrationLayerPreview[];
  errors: string[];
}
export interface FixedCodeSimulationResult {
  total: number;
  counts: Record<string, number>;
  completedAt: string;
}
export interface MigrationExecution {
  mode: MigrationMode;
  completedAt: string;
  layers: { layer: string; table: string; inserted: number }[];
  progress: {
    phase: string;
    completedLayers: number;
    totalLayers: number;
    processedRecords: number;
    totalRecords: number;
  };
}

function formData(files: File[], mode?: MigrationMode) {
  const body = new FormData();
  for (const file of files) body.append("files", file, file.name);
  if (mode) body.append("mode", mode);
  return body;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `La solicitud falló (HTTP ${response.status}).`;
    try {
      const problem = await response.json() as { detail?: string; title?: string };
      detail = problem.detail || problem.title || detail;
    } catch { /* Keep the HTTP fallback. */ }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export async function simulateFixedCodeStates(signal?: AbortSignal) {
  return readResponse<FixedCodeSimulationResult>(await apiFetch("/api/migrations/codigos-fijos/simulate-states", {
    method: "POST", body: JSON.stringify({ confirmed: true }), headers: { "Content-Type": "application/json" }, signal,
  }));
}

export async function validateMigration(files: File[], signal?: AbortSignal) {
  return readResponse<MigrationValidation>(await apiFetch("/api/migrations/validate", {
    method: "POST", body: formData(files), headers: {}, signal,
  }));
}

export async function executeMigration(files: File[], mode: MigrationMode, signal?: AbortSignal) {
  return readResponse<MigrationExecution>(await apiFetch("/api/migrations/execute", {
    method: "POST", body: formData(files, mode), headers: {}, signal,
  }));
}
