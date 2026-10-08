import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeDefinition, createTemplate, exportReport, previewReport, type ReportDefinition } from "./reports";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("./auth", () => ({ apiFetch }));

const definition: ReportDefinition = { layer: "CodigosFijos", columns: ["Nombre"], q: "", filters: [], groupBy: "Estado", sort: [], format: "pdf", orientation: "auto", title: "", includeParameters: true };

describe("reports client", () => {
  beforeEach(() => apiFetch.mockReset());

  it("downloads small reports immediately", async () => {
    apiFetch.mockResolvedValue(new Response(new Blob(["%PDF"]), { status: 200, headers: { "Content-Disposition": "attachment; filename=reporte_codigos_fijos_2026-10-06_1003.pdf" } }));
    const result = await exportReport(definition);
    expect(result).toMatchObject({ kind: "file", file: { fileName: "reporte_codigos_fijos_2026-10-06_1003.pdf" } });
    expect(apiFetch).toHaveBeenCalledWith("/api/reports/export", { method: "POST", body: JSON.stringify(definition) });
  });

  it("returns a background job when the API accepts a large report", async () => {
    const job = { id: "abc", status: "queued", title: "Reporte de lotes", layer: "Lotes", format: "xlsx", fileName: null, error: null, createdAt: "", completedAt: null };
    apiFetch.mockResolvedValue(Response.json({ data: { job, total: 15281 } }, { status: 202 }));
    expect(await exportReport(definition)).toEqual({ kind: "job", job, total: 15281 });
  });

  it("surfaces validation messages from the API", async () => {
    apiFetch.mockResolvedValue(Response.json({ title: "Invalid report", detail: "'Código fijo' necesita un número entero." }, { status: 400 }));
    await expect(previewReport(definition)).rejects.toThrow("'Código fijo' necesita un número entero.");
    apiFetch.mockResolvedValue(Response.json({ detail: "Ya tenés una plantilla con ese nombre." }, { status: 409 }));
    await expect(createTemplate("Mía", definition)).rejects.toThrow("Ya tenés una plantilla con ese nombre.");
  });

  it("completes partial template definitions with defaults", () => {
    expect(completeDefinition({ layer: "Vias" }, { id: "Vias", title: "Vías", defaultColumns: ["IdVia", "Nombre"], fields: [] })).toEqual({
      layer: "Vias", columns: ["IdVia", "Nombre"], q: "", filters: [], groupBy: null, sort: [], format: "xlsx", orientation: "auto", title: "", includeParameters: true
    });
  });
});
