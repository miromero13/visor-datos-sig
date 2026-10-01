import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ShapefileSourcePage } from "./ShapefileSourcePage";

afterEach(() => vi.unstubAllGlobals());

describe("ShapefileSourcePage", () => {
  it("provides accessible selection and renders backend incomplete-layer results", async () => {
    const { container } = render(<MemoryRouter><ShapefileSourcePage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /seleccionar archivos shapefile/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/seleccionar archivos shapefile/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/seleccionar carpeta con archivos shapefile/i)).toHaveAttribute("webkitdirectory");
    const picker = screen.getByLabelText(/seleccionar archivos shapefile/i);
    fireEvent.change(picker, { target: { files: [new File([""], "Roads.SHP"), new File([""], "roads.dbf")] } });
    expect(screen.getByText(/Enviá los archivos/)).toBeInTheDocument();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ layers: [{ name: "Roads", files: ["Roads.SHP", "roads.dbf"], complete: false, missingExtensions: [".shx", ".prj"] }] }), { status: 200 })));
    fireEvent.click(screen.getByRole("button", { name: /enviar archivos/i }));
    await waitFor(() => expect(screen.getByText("Incompleta")).toBeInTheDocument());
    expect(screen.getByText("Faltan componentes: .shx, .prj")).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });
});
