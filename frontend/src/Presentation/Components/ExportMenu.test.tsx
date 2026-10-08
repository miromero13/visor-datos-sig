import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportMenu } from "./ExportMenu";

const mocks = vi.hoisted(() => ({ exportResults: vi.fn(), saveFile: vi.fn() }));
vi.mock("@/Application/Services/exports", () => mocks);

const request = { layer: "Lotes" as const, q: "12", filters: { IdManzana: "4" }, columns: ["IdLote", "NroLote"], page: 1, pageSize: 25 };

describe("ExportMenu", () => {
  beforeEach(() => { mocks.exportResults.mockReset(); mocks.saveFile.mockReset(); });

  it("exports the current query with the chosen format and scope", async () => {
    const file = { blob: new Blob(["x"]), fileName: "reporte_lotes.pdf" };
    mocks.exportResults.mockResolvedValue(file);
    const onError = vi.fn();
    render(<ExportMenu request={request} onError={onError} />);

    await userEvent.click(screen.getByRole("button", { name: /exportar/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /todos los resultados en pdf/i }));

    await waitFor(() => expect(mocks.saveFile).toHaveBeenCalledWith(file));
    expect(mocks.exportResults).toHaveBeenCalledWith({ ...request, format: "pdf", scope: "all" });
  });

  it("shows a loading state while the file is generated", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.exportResults.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<ExportMenu request={request} onError={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /exportar/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /página actual en excel/i }));

    const busy = await screen.findByRole("button", { name: /generando/i });
    expect(busy).toBeDisabled();
    finish({ blob: new Blob(), fileName: "a.xlsx" });
    await screen.findByRole("button", { name: /exportar/i });
  });

  it("reports export errors to the page", async () => {
    mocks.exportResults.mockRejectedValue(new Error("La consulta tiene 60.000 registros."));
    const onError = vi.fn();
    render(<ExportMenu request={request} onError={onError} />);

    await userEvent.click(screen.getByRole("button", { name: /exportar/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /todos los resultados en excel/i }));

    await waitFor(() => expect(onError).toHaveBeenLastCalledWith("La consulta tiene 60.000 registros."));
    expect(mocks.saveFile).not.toHaveBeenCalled();
  });

  it("is disabled with an explanation when there is nothing to export", () => {
    render(<ExportMenu request={null} disabledReason="Elegí una capa para exportar sus resultados." onError={vi.fn()} />);
    const button = screen.getByRole("button", { name: /exportar/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Elegí una capa para exportar sus resultados.");
  });

  it("opens the custom report builder even when quick exports are unavailable", async () => {
    const onCustomReport = vi.fn();
    render(<ExportMenu request={null} disabledReason="Elegí una capa para exportar sus resultados." onError={vi.fn()} onCustomReport={onCustomReport} />);
    await userEvent.click(screen.getByRole("button", { name: /exportar/i }));
    expect(await screen.findByRole("menuitem", { name: /página actual en excel/i })).toHaveAttribute("data-disabled");
    expect(screen.getByText("Elegí una capa para exportar sus resultados.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: /reporte personalizado/i }));
    expect(onCustomReport).toHaveBeenCalled();
  });
});
