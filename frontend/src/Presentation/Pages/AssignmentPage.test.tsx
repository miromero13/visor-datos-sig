import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssignmentPage } from "./AssignmentPage";

const mocks = vi.hoisted(() => ({
  getOperators: vi.fn(), getAssignments: vi.fn(), calculateOptimalRoute: vi.fn(),
  saveAssignment: vi.fn(), parseMapLinkOrCoordinates: vi.fn(),
  clearLayers: vi.fn(),
}));
vi.mock("@/Application/Services/operations", () => mocks);
vi.mock("@/Application/Services/layers", () => ({
  getLayerExtent: vi.fn().mockResolvedValue(null), getFixedStateColor: () => "#ff0000",
}));
vi.mock("@/Presentation/Layouts/AuthenticatedLayout", () => ({
  AuthenticatedLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("leaflet", () => {
  const layer = () => {
    const result = { addTo: vi.fn(() => result), bindPopup: vi.fn(() => result), openPopup: vi.fn(), getBounds: () => ({ isValid: () => false }) };
    return result;
  };
  return { default: {
    map: () => ({ on: vi.fn(), remove: vi.fn(), setView: vi.fn(), invalidateSize: vi.fn(), fitBounds: vi.fn() }),
    tileLayer: layer, marker: layer, divIcon: vi.fn(),
    layerGroup: () => { const group = { addTo: () => group, clearLayers: mocks.clearLayers }; return group; },
    geoJSON: layer,
  } };
});
vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn(); });

const operator = { idUsuario: 7, nombre: "Pedro", rol: "Cortador", tareasPendientesHoy: 0, tareasCompletadasHoy: 0 };
const successMessage = "Asignación #42 guardada. Se asignó 1 parada a Pedro. Podés consultar el detalle en el historial.";
const assignment = { message: "Asignación guardada exitosamente.", idAsignacion: 42, operador: "Pedro", estado: "Asignada", cantidadCodigos: 1, completados: 0, pendientes: 1 };

async function configure(mode: "Corte" | "Reconexion" = "Corte") {
  render(<AssignmentPage mode={mode} />);
  await screen.findByRole("option", { name: /Pedro/ });
  fireEvent.change(screen.getByLabelText("Cantidad de órdenes"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Pegar enlace de Google Maps o coordenadas"), { target: { value: "-16.39, -60.97" } });
  fireEvent.click(screen.getByRole("button", { name: "Ubicar" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar P0" }));
  fireEvent.click(screen.getByRole("button", { name: "Calcular ruta óptima" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Guardar asignación" })).toBeEnabled());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAssignments.mockReset();
  mocks.saveAssignment.mockReset();
  mocks.getOperators.mockResolvedValue([operator]);
  mocks.getAssignments.mockResolvedValue([]);
  mocks.saveAssignment.mockResolvedValue(assignment);
  mocks.parseMapLinkOrCoordinates.mockReturnValue({ lat: -16.39, lon: -60.97 });
  mocks.calculateOptimalRoute.mockResolvedValue({ totalParadas: 1, distanciaTotalMeters: 100,
    rutaGeoJson: { type: "FeatureCollection", features: [] },
    paradas: [{ idCodigo: 11, orden: 1, nombre: "Cliente", codFijo: "CF11", lat: -16.39, lon: -60.97, distanciaDesdeAnteriorMeters: 100, distanciaAcumuladaMeters: 100 }],
  });
});

describe("AssignmentPage save lifecycle", () => {
  it.each(["Corte", "Reconexion"] as const)("clears a saved %s proposal and keeps confirmation and refreshed history", async (mode) => {
    await configure(mode);
    mocks.getAssignments.mockResolvedValue([assignment]);
    mocks.clearLayers.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Guardar asignación" }));
    await screen.findByText(successMessage);
    expect(screen.getByRole("tab", { name: /Historial/ })).toHaveAttribute("aria-selected", "true");
    await screen.findByText("#42 · Pedro");
    expect(screen.getByRole("status")).toHaveTextContent(successMessage);
    const createButton = screen.getByRole("button", { name: "Preparar otra asignación" });
    expect(createButton).toBeEnabled();
    fireEvent.click(createButton);
    expect(screen.getByRole("tab", { name: /Configuración/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Operador asignado")).toHaveValue("");
    expect(screen.getByLabelText("Cantidad de órdenes")).toHaveValue(null);
    expect(screen.getByLabelText("Pegar enlace de Google Maps o coordenadas")).toHaveValue("");
    expect(screen.queryByText("Origen P0 confirmado")).not.toBeInTheDocument();
    expect(mocks.clearLayers).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Guardar asignación" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Guardar asignación" }));
    expect(mocks.saveAssignment).toHaveBeenCalledTimes(1);
    expect(mocks.saveAssignment).toHaveBeenCalledWith({ idUsuario: 7, tipo: mode, puntoPartida: { lat: -16.39, lon: -60.97 }, idsCodigosFijos: [11] });
    fireEvent.click(screen.getByRole("tab", { name: /Historial/ }));
    await screen.findByText("#42 · Pedro");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("consumes the proposal even when history refresh fails", async () => {
    await configure();
    mocks.getAssignments.mockRejectedValueOnce(new Error("Sin conexión"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar asignación" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("status")).toHaveTextContent(successMessage);
    expect(screen.getByRole("tab", { name: /Historial/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Preparar otra asignación" }));
    expect(screen.getByRole("button", { name: "Guardar asignación" })).toBeDisabled();
    expect(mocks.saveAssignment).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Cantidad de órdenes")).toHaveValue(null);
  });

  it("preserves the proposal on failed save and allows retry", async () => {
    await configure();
    mocks.saveAssignment.mockRejectedValueOnce(new Error("El operador no está disponible."));
    fireEvent.click(screen.getByRole("button", { name: "Guardar asignación" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la asignación. El operador no está disponible.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar asignación" })).toBeEnabled();
    fireEvent.click(screen.getByRole("tab", { name: /Configuración/ }));
    expect(screen.getByLabelText("Cantidad de órdenes")).toHaveValue(1);
    expect(screen.getByLabelText("Operador asignado")).toHaveValue("7");
    expect(screen.getByText("Origen P0 confirmado")).toBeInTheDocument();
  });
});
