import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapPage } from "./MapPage";

const mocks = vi.hoisted(() => ({ getLayerDetail: vi.fn(), getLayers: vi.fn(), getLayerFeatures: vi.fn(), getAllFixedCodeFeatures: vi.fn(), getLayerExtent: vi.fn(), searchLayer: vi.fn(), select: vi.fn() }));
const container = document.createElement("div");
Object.defineProperties(container, { clientWidth: { value: 800 }, clientHeight: { value: 600 }, getBoundingClientRect: { value: () => ({ width: 800, height: 600 }) } });
const mapFixture = { on: vi.fn(), off: vi.fn(), getContainer: () => container, invalidateSize: vi.fn(), getZoom: () => 15, getMaxZoom: () => 17, getMinZoom: () => 1, fitBounds: vi.fn(), setZoom: vi.fn(), setView: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), addControl: vi.fn(), removeControl: vi.fn(), getBounds: vi.fn() };
vi.mock("@/Application/Services/layers", () => mocks);
vi.mock("@/Presentation/Layouts/AuthenticatedLayout", () => ({ AuthenticatedLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("react-leaflet", async () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pane: ({ children }: { children: React.ReactNode }) => <>{children}</>, TileLayer: () => null, useMap: () => mapFixture,
  GeoJSON: ({ data, onEachFeature }: { data?: { features?: Array<{ id?: number; properties?: object }> }; onEachFeature?: (feature: unknown, layer: { on: (event: string, handler: (event: unknown) => void) => void }) => void }) => <>{data?.features?.map((feature) => {
    let click = () => {};
    onEachFeature?.(feature, { on: (_event, handler) => { click = () => handler({}); } });
    return <button key={feature.id} onClick={click}>Select feature {feature.id}</button>;
  })}</>,
}));
vi.mock("leaflet", () => {
  class Control { onAdd?: () => HTMLElement; addTo = vi.fn(function (this: Control) { this.onAdd?.(); return this; }); remove = vi.fn(); }
  return { default: { Control, DomUtil: { create: (tag: string, _className?: string, parent?: HTMLElement) => { const element = document.createElement(tag); parent?.append(element); return element; } }, DomEvent: { on: vi.fn(), stopPropagation: vi.fn(), disableClickPropagation: vi.fn(), disableScrollPropagation: vi.fn() }, geoJSON: () => ({ getBounds: () => ({ isValid: () => false }) }), divIcon: vi.fn(), svg: vi.fn(() => ({})), point: vi.fn() } };
});
vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn(); });
vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
vi.stubGlobal("cancelAnimationFrame", vi.fn());
vi.mock("html2canvas", () => ({ default: vi.fn() }));

const layer = { id: "Lotes", label: "Lotes", geometryType: "Polygon", srid: 4326 };
const collection: { type: string; features: Array<{ type: string; id: number; geometry: null; properties: Record<string, unknown> }>; numberReturned: number; limit: number; srid: number } = { type: "FeatureCollection", features: [{ type: "Feature", id: 12, geometry: null, properties: { IdLote: 12 } }], numberReturned: 1, limit: 1000, srid: 4326 };

describe("MapPage detail hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLayers.mockResolvedValue([layer]);
    mocks.getLayerFeatures.mockResolvedValue(collection);
    mocks.getAllFixedCodeFeatures.mockResolvedValue(collection);
    mocks.getLayerExtent.mockResolvedValue(null);
    mocks.searchLayer.mockResolvedValue({ data: { items: [] } });
    mocks.getLayerDetail.mockResolvedValue({ ...collection.features[0], properties: { IdLote: 12, Descripcion: "Full detail" } });
  });

  it("hydrates full details on feature selection", async () => {
    render(<MemoryRouter><MapPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Select feature 12" }));
    await waitFor(() => expect(mocks.getLayerDetail).toHaveBeenCalledWith("Lotes", 12, expect.any(AbortSignal)));
    expect(await screen.findByText("Full detail")).toBeInTheDocument();
  });

  it("ignores stale detail responses after selecting another feature", async () => {
    let resolveA!: (value: typeof collection.features[number]) => void;
    mocks.getLayerFeatures.mockResolvedValue({ ...collection, features: [...collection.features, { ...collection.features[0], id: 13 }] });
    mocks.getLayerDetail.mockImplementation((_layer: string, id: number) => id === 12 ? new Promise((resolve) => { resolveA = resolve; }) : Promise.resolve({ ...collection.features[0], id: 13, properties: { Descripcion: "B details" } }));
    render(<MemoryRouter><MapPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Select feature 12" }));
    fireEvent.click(screen.getByRole("button", { name: "Select feature 13" }));
    expect(await screen.findByText("B details")).toBeInTheDocument();
    resolveA({ ...collection.features[0], properties: { Descripcion: "Stale A" } });
    await waitFor(() => expect(screen.queryByText("Stale A")).not.toBeInTheDocument());
  });

  it("allows retry after detail failure", async () => {
    mocks.getLayerDetail.mockRejectedValueOnce(new Error("Temporary failure")).mockResolvedValueOnce({ ...collection.features[0], properties: { Descripcion: "Retried detail" } });
    render(<MemoryRouter><MapPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Select feature 12" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Retried detail")).toBeInTheDocument();
    expect(mocks.getLayerDetail).toHaveBeenCalledTimes(2);
  });

  it("aborts detail requests when the selection closes and when the page unmounts", async () => {
    mocks.getLayerDetail.mockReturnValue(new Promise(() => {}));
    const view = render(<MemoryRouter><MapPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Select feature 12" }));
    await waitFor(() => expect(mocks.getLayerDetail).toHaveBeenCalled());
    const closeSignal = mocks.getLayerDetail.mock.calls.at(-1)?.[2] as AbortSignal;
    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle del elemento" }));
    expect(closeSignal.aborted).toBe(true);
    fireEvent.click(await screen.findByRole("button", { name: "Select feature 12" }));
    const unmountSignal = mocks.getLayerDetail.mock.calls.at(-1)?.[2] as AbortSignal;
    view.unmount();
    expect(unmountSignal.aborted).toBe(true);
  });
});
