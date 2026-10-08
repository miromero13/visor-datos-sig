import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportLayer } from "@/Application/Services/reports";
import { ReportBuilderDialog } from "./ReportBuilderDialog";

const mocks = vi.hoisted(() => ({
  getReportFields: vi.fn(), listTemplates: vi.fn(), previewReport: vi.fn(), exportReport: vi.fn(), createTemplate: vi.fn(), updateTemplate: vi.fn(), deleteTemplate: vi.fn(),
  saveFile: vi.fn(), trackReportJob: vi.fn()
}));
vi.mock("@/Application/Services/reports", async importOriginal => ({ ...(await importOriginal<object>()), ...mocks }));
vi.mock("@/Application/Services/exports", () => ({ saveFile: mocks.saveFile }));
vi.mock("@/Application/Services/reportJobs", () => ({ trackReportJob: mocks.trackReportJob }));

const states = [{ value: "1", label: "Normal" }, { value: "2", label: "Para corte" }, { value: "3", label: "Cortado" }];
const layers: ReportLayer[] = [
  {
    id: "CodigosFijos", title: "Códigos fijos", defaultColumns: ["CodFijo", "Nombre", "Estado"], fields: [
      { key: "CodFijo", label: "Código fijo", kind: "integer", filterKind: "integer", operators: ["equals", "in", "between", "gte", "lte"], options: null, groupable: true },
      { key: "Nombre", label: "Nombre", kind: "text", filterKind: "text", operators: ["contains", "equals", "startsWith", "in"], options: null, groupable: true },
      { key: "Estado", label: "Estado", kind: "text", filterKind: "integer", operators: ["equals", "in", "between", "gte", "lte"], options: states, groupable: true },
      { key: "FechaCambioEstado", label: "Fecha de cambio de estado", kind: "date", filterKind: "date", operators: ["between", "gte", "lte"], options: null, groupable: false }
    ]
  },
  { id: "Vias", title: "Vías", defaultColumns: ["Nombre"], fields: [{ key: "Nombre", label: "Nombre", kind: "text", filterKind: "text", operators: ["contains"], options: null, groupable: true }] }
];
const template = { id: 4, name: "Cortes", layer: "CodigosFijos" as const, createdAt: "", updatedAt: "", definition: { layer: "CodigosFijos" as const, columns: ["Nombre"], q: "", filters: [{ field: "Estado", operator: "in" as const, values: ["2", "3"] }], groupBy: "Estado", sort: [], format: "pdf" as const, orientation: "auto" as const, title: "Cortes", includeParameters: true } };

const lastBody = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.at(-1)![0];

describe("ReportBuilderDialog", () => {
  beforeEach(() => {
    Object.values(mocks).forEach(m => m.mockReset());
    mocks.getReportFields.mockResolvedValue(layers);
    mocks.listTemplates.mockResolvedValue([template]);
  });

  it("starts from the query screen state", async () => {
    mocks.previewReport.mockResolvedValue({ columns: [{ key: "CodFijo", label: "Código fijo", kind: "integer" }], rows: [["501"]], total: 1, groupBy: null, groups: [], maxRows: 50000, asyncThreshold: 5000 });
    render(<ReportBuilderDialog open onOpenChange={vi.fn()} initial={{ layer: "CodigosFijos", q: " maría ", filters: { Estado: "2", Nombre: "Peña", IdLote: "" } }} />);
    await screen.findByRole("list", { name: "Columnas seleccionadas" });
    await userEvent.click(screen.getByRole("button", { name: /previsualizar/i }));
    await screen.findByText("1 registros");
    expect(lastBody(mocks.previewReport)).toMatchObject({
      layer: "CodigosFijos", q: "maría", columns: ["CodFijo", "Nombre", "Estado"],
      filters: [{ field: "Estado", operator: "equals", value: "2" }, { field: "Nombre", operator: "contains", value: "Peña" }]
    });
  });

  it("reorders columns, groups, adds a date range and exports", async () => {
    mocks.exportReport.mockResolvedValue({ kind: "file", file: { blob: new Blob(), fileName: "reporte.xlsx" } });
    render(<ReportBuilderDialog open onOpenChange={vi.fn()} initial={{ layer: "CodigosFijos" }} />);
    await userEvent.click(await screen.findByRole("button", { name: "Bajar Código fijo" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /fecha de cambio de estado/i }));

    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    await userEvent.click(screen.getByRole("button", { name: /agregar condición/i }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Condición 1: campo" }), "FechaCambioEstado");
    await userEvent.type(screen.getByLabelText("Condición 1: desde"), "2026-01-01");
    await userEvent.type(screen.getByLabelText("Condición 1: hasta"), "2026-01-31");

    await userEvent.click(screen.getByRole("button", { name: "Agrupar y ordenar" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Agrupar por" }), "Estado");
    await userEvent.click(screen.getByRole("button", { name: /agregar orden/i }));

    await userEvent.click(screen.getByRole("button", { name: /exportar excel/i }));
    await waitFor(() => expect(mocks.saveFile).toHaveBeenCalled());
    expect(lastBody(mocks.exportReport)).toMatchObject({
      columns: ["Nombre", "CodFijo", "Estado", "FechaCambioEstado"],
      filters: [{ field: "FechaCambioEstado", operator: "between", value: "2026-01-01", valueTo: "2026-01-31" }],
      groupBy: "Estado", sort: [{ field: "CodFijo", direction: "asc" }], format: "xlsx"
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Descargaste reporte.xlsx");
  });

  it("tracks large reports as background jobs", async () => {
    const job = { id: "j1", status: "queued", title: "Reporte de códigos fijos" };
    mocks.exportReport.mockResolvedValue({ kind: "job", job, total: 6271 });
    render(<ReportBuilderDialog open onOpenChange={vi.fn()} initial={{ layer: "CodigosFijos" }} />);
    await screen.findByRole("list", { name: "Columnas seleccionadas" });
    await userEvent.click(screen.getByRole("button", { name: /exportar excel/i }));
    await waitFor(() => expect(mocks.trackReportJob).toHaveBeenCalledWith(job));
    expect(screen.getByRole("status")).toHaveTextContent("6.271 registros");
  });

  it("opens, updates and deletes templates", async () => {
    mocks.updateTemplate.mockImplementation(async (id: number, name: string, definition: object) => ({ ...template, id, name, definition }));
    mocks.deleteTemplate.mockResolvedValue(undefined);
    render(<ReportBuilderDialog open onOpenChange={vi.fn()} initial={{ layer: "Vias" }} />);
    const panel = (await screen.findAllByRole("region", { name: "Mis plantillas" }))[0];
    await userEvent.click(await within(panel).findByRole("button", { name: "Abrir plantilla Cortes" }));
    expect(screen.getByRole("combobox", { name: "Capa del reporte" })).toHaveValue("CodigosFijos");
    expect(screen.getByRole("textbox", { name: "Nombre de la plantilla" })).toHaveValue("Cortes");

    await userEvent.click(screen.getByRole("button", { name: "Formato" }));
    await userEvent.click(screen.getByRole("radio", { name: /excel/i }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(mocks.updateTemplate).toHaveBeenCalled());
    expect(mocks.updateTemplate.mock.calls[0][0]).toBe(4);
    expect(mocks.updateTemplate.mock.calls[0][2]).toMatchObject({ format: "xlsx", groupBy: "Estado", filters: [{ field: "Estado", operator: "in", values: ["2", "3"] }] });

    await userEvent.click(within(panel).getByRole("button", { name: "Eliminar plantilla Cortes" }));
    await userEvent.click(within(panel).getByRole("button", { name: "Sí, eliminar" }));
    await waitFor(() => expect(mocks.deleteTemplate).toHaveBeenCalledWith(4));
    expect(within(panel).queryByText("Cortes")).not.toBeInTheDocument();
  });

  it("shows API validation errors without losing the configuration", async () => {
    mocks.previewReport.mockRejectedValue(new Error("Completá el valor del filtro 'Nombre'."));
    render(<ReportBuilderDialog open onOpenChange={vi.fn()} initial={{ layer: "CodigosFijos" }} />);
    await screen.findByRole("list", { name: "Columnas seleccionadas" });
    await userEvent.click(screen.getByRole("button", { name: /previsualizar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Completá el valor del filtro 'Nombre'.");
    expect(screen.getByRole("combobox", { name: "Capa del reporte" })).toHaveValue("CodigosFijos");
  });

  it("asks for a template name before saving", async () => {
    render(<ReportBuilderDialog open onOpenChange={vi.fn()} initial={{ layer: "CodigosFijos" }} />);
    await screen.findByRole("list", { name: "Columnas seleccionadas" });
    await userEvent.click(screen.getByRole("button", { name: "Guardar plantilla" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Escribí un nombre para la plantilla.");
    expect(mocks.createTemplate).not.toHaveBeenCalled();
  });

  it("keeps the chosen format after closing and reopening, until starting over", async () => {
    mocks.exportReport.mockResolvedValue({ kind: "job", job: { id: "j2", status: "queued", title: "t" }, total: 6271 });
    const { rerender } = render(<ReportBuilderDialog open onOpenChange={vi.fn()} initial={{ layer: "CodigosFijos" }} />);
    await screen.findByRole("list", { name: "Columnas seleccionadas" });
    await userEvent.click(screen.getByRole("button", { name: "Formato" }));
    await userEvent.click(screen.getByRole("radio", { name: /pdf/i }));

    rerender(<ReportBuilderDialog open={false} onOpenChange={vi.fn()} initial={{ layer: "CodigosFijos" }} />);
    rerender(<ReportBuilderDialog open onOpenChange={vi.fn()} initial={{ layer: "CodigosFijos" }} />);
    await userEvent.click(await screen.findByRole("button", { name: /exportar pdf/i }));
    await waitFor(() => expect(lastBody(mocks.exportReport)).toMatchObject({ format: "pdf" }));

    await userEvent.click(screen.getByRole("button", { name: /empezar de nuevo/i }));
    expect(screen.getByRole("button", { name: /exportar excel/i })).toBeInTheDocument();
  });
});
