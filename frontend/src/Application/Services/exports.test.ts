import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportResults, fileNameFromDisposition } from "./exports";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("./auth", () => ({ apiFetch }));

const request = { layer: "CodigosFijos" as const, format: "xlsx" as const, scope: "all" as const, q: "  Peña ", filters: { Estado: "2", Nombre: "  " }, columns: ["IdCodigo", "Nombre"], page: 2, pageSize: 25 };

describe("exportResults", () => {
  beforeEach(() => apiFetch.mockReset());

  it("sends the visible query state and uses the server file name", async () => {
    apiFetch.mockResolvedValue(new Response(new Blob(["x"]), { status: 200, headers: { "Content-Disposition": "attachment; filename=reporte_codigos_fijos_2026-10-06_1430.xlsx; filename*=UTF-8''reporte_codigos_fijos_2026-10-06_1430.xlsx" } }));
    const file = await exportResults(request);
    const [path, init] = apiFetch.mock.calls[0];
    expect(path).toBe("/api/exports");
    expect(JSON.parse(init.body)).toEqual({ layer: "CodigosFijos", format: "xlsx", scope: "all", q: "Peña", filters: { Estado: "2" }, columns: ["IdCodigo", "Nombre"], page: 2, pageSize: 25 });
    expect(file.fileName).toBe("reporte_codigos_fijos_2026-10-06_1430.xlsx");
  });

  it("falls back to a descriptive name when the header is not exposed", async () => {
    apiFetch.mockResolvedValue(new Response(new Blob(["x"]), { status: 200 }));
    expect((await exportResults({ ...request, format: "pdf" })).fileName).toMatch(/^reporte_codigos_fijos_\d{4}-\d{2}-\d{2}_\d{4}\.pdf$/);
  });

  it("shows the server explanation when the export is rejected", async () => {
    apiFetch.mockResolvedValue(Response.json({ title: "Export too large", detail: "La consulta tiene 60.000 registros y el máximo exportable es 50.000." }, { status: 422 }));
    await expect(exportResults(request)).rejects.toThrow("máximo exportable es 50.000");
  });

  it("uses a clear message for expired sessions and network errors without details", async () => {
    apiFetch.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(exportResults(request)).rejects.toThrow("Tu sesión expiró");
    apiFetch.mockResolvedValue(new Response("oops", { status: 500 }));
    await expect(exportResults(request)).rejects.toThrow("No se pudo generar el archivo");
  });

  it("parses quoted and encoded Content-Disposition values", () => {
    expect(fileNameFromDisposition('attachment; filename="reporte_vias.pdf"')).toBe("reporte_vias.pdf");
    expect(fileNameFromDisposition("attachment; filename*=UTF-8''reporte_v%C3%ADas.pdf")).toBe("reporte_vías.pdf");
    expect(fileNameFromDisposition(null)).toBeNull();
  });
});
