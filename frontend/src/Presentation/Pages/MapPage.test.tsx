import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapPage } from "./MapPage";

const mocks = vi.hoisted(() => ({ getLayerDetail: vi.fn(), getLayers: vi.fn(), getLayerFeatures: vi.fn(), getAllFixedCodeFeatures: vi.fn(), getLayerExtent: vi.fn(), searchLayer: vi.fn(), select: vi.fn(), roots: [] as Array<{ addData: ReturnType<typeof vi.fn>; clearLayers: ReturnType<typeof vi.fn>; eachLayer: (callback: (layer: unknown) => void) => void }>, requests: [] as Array<{ signal: AbortSignal; options: { pageSize: number; minimal: boolean; onPage: (page: any, count: number) => Promise<void> }; resolve: (value: unknown) => void; reject: (error: unknown) => void }>, frames: new Map<number, FrameRequestCallback>(), nextFrame: 0 }));
const container = document.createElement("div");
Object.defineProperties(container, { clientWidth: { value: 800 }, clientHeight: { value: 600 }, getBoundingClientRect: { value: () => ({ width: 800, height: 600 }) } });
const mapFixture = { on: vi.fn(), off: vi.fn(), getContainer: () => container, invalidateSize: vi.fn(), getZoom: () => 15, getMaxZoom: () => 17, getMinZoom: () => 1, fitBounds: vi.fn(), setZoom: vi.fn(), setView: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), addControl: vi.fn(), removeControl: vi.fn(), getBounds: vi.fn() };
vi.mock("@/Application/Services/layers", () => mocks);
vi.mock("@/Presentation/Layouts/AuthenticatedLayout", () => ({ AuthenticatedLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("react-leaflet", async () => {
  const React = await import("react");
  const GeoJSON = React.forwardRef((props: { pane?: string; data?: { features?: Array<{ id?: number; properties?: object }> }; onEachFeature?: (feature: unknown, layer: { on: (event: string, handler: (event: unknown) => void) => void }) => void }, ref) => {
    const [features, setFeatures] = React.useState(props.data?.features ?? []);
    const root = React.useMemo(() => ({ addData: vi.fn((feature: unknown) => setFeatures((previous) => [...previous, feature as { id?: number; properties?: object }])), clearLayers: vi.fn(() => setFeatures([])), eachLayer: (_callback: (layer: unknown) => void) => {} }), []);
    React.useImperativeHandle(ref, () => root, [root]);
    React.useEffect(() => { if (props.pane === "fixed-codes-overlay") mocks.roots.push(root); return () => { mocks.roots = mocks.roots.filter((item) => item !== root); }; }, [root, props.pane]);
    return <>{features.map((feature, index) => { let click = () => {}; props.onEachFeature?.(feature, { on: (_event, handler) => { click = () => handler({}); } }); return <button key={`${feature.id}-${index}`} onClick={click}>Select feature {feature.id}</button>; })}</>;
  });
  return ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pane: ({ children }: { children: React.ReactNode }) => <>{children}</>, TileLayer: () => null, useMap: () => mapFixture,
  GeoJSON,
  });
});
vi.mock("leaflet", () => {
  class Control { onAdd?: () => HTMLElement; addTo = vi.fn(function (this: Control) { this.onAdd?.(); return this; }); remove = vi.fn(); }
  return { default: { Control, DomUtil: { create: (tag: string, _className?: string, parent?: HTMLElement) => { const element = document.createElement(tag); parent?.append(element); return element; } }, DomEvent: { on: vi.fn(), stopPropagation: vi.fn(), disableClickPropagation: vi.fn(), disableScrollPropagation: vi.fn() }, geoJSON: () => ({ getBounds: () => ({ isValid: () => false }) }), divIcon: vi.fn(), svg: vi.fn(() => ({})), point: vi.fn() } };
});
vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn(); });
vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { const id = ++mocks.nextFrame; mocks.frames.set(id, callback); return id; }));
vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => mocks.frames.delete(id)));
async function drawNextFrame() { const entry = mocks.frames.entries().next().value as [number, FrameRequestCallback] | undefined; if (!entry) return; mocks.frames.delete(entry[0]); await act(async () => { entry[1](performance.now()); await Promise.resolve(); }); }
async function drawUntilAdded(root: typeof mocks.roots[number], count: number) { for (let i = 0; i < 20 && root.addData.mock.calls.length < count; i++) await drawNextFrame(); }
vi.mock("html2canvas", () => ({ default: vi.fn() }));

const layer = { id: "Lotes", label: "Lotes", geometryType: "Polygon", srid: 4326 };
const collection: { type: string; features: Array<{ type: string; id: number; geometry: null; properties: Record<string, unknown> }>; numberReturned: number; limit: number; srid: number } = { type: "FeatureCollection", features: [{ type: "Feature", id: 12, geometry: null, properties: { IdLote: 12 } }], numberReturned: 1, limit: 1000, srid: 4326 };

describe("MapPage detail hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roots = []; mocks.requests = []; mocks.frames.clear(); mocks.nextFrame = 0;
    mocks.getLayers.mockResolvedValue([layer]);
    mocks.getLayerFeatures.mockResolvedValue(collection);
    mocks.getAllFixedCodeFeatures.mockResolvedValue(collection);
    mocks.getLayerExtent.mockResolvedValue({ west: 0, south: 0, east: 1, north: 1 });
    mocks.searchLayer.mockResolvedValue({ data: { items: [] } });
    mocks.getLayerDetail.mockResolvedValue({ ...collection.features[0], properties: { IdLote: 12, Descripcion: "Full detail" } });
  });

  it("draws each validated page into one persistent root before the next request and preserves selection", async () => {
    mocks.getLayers.mockResolvedValue([{ id: "CodigosFijos", label: "Códigos fijos", geometryType: "Point", srid: 4326 }]);
    mocks.getAllFixedCodeFeatures.mockImplementation((_filters: unknown, signal: AbortSignal, options: { pageSize: number; minimal: boolean; onPage: (page: any, count: number) => Promise<void> }) => new Promise((resolve, reject) => { mocks.requests.push({ signal, options, resolve, reject }); }));
    render(<MemoryRouter><MapPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.requests.length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText("Nombre del propietario"), { target: { value: "Ana" } });
    await waitFor(() => expect(mocks.requests.length).toBeGreaterThan(1), { timeout: 1500 });
    const request = mocks.requests.at(-1)!;
    expect(request.options).toMatchObject({ pageSize: 5000, minimal: true });
    const root = mocks.roots.at(-1)!;
    const feature = (id: number) => ({ type: "Feature", id, geometry: null, properties: { Nombre: "Ana", Estado: 1 } });
    let first!: Promise<void>;
    await act(async () => { first = request.options.onPage({ features: [feature(41)] }, 1); });
    expect(root.addData).not.toHaveBeenCalled();
    await drawUntilAdded(root, 1); await first;
    expect(root.addData).toHaveBeenCalledTimes(1);
    fireEvent.click(await screen.findByRole("button", { name: /Ubicar Ana, código 41/ }));
    expect(await screen.findByLabelText("Atributos del elemento seleccionado")).toBeInTheDocument();
    let second!: Promise<void>;
    await act(async () => { second = request.options.onPage({ features: [feature(42)] }, 2); });
    await drawUntilAdded(root, 2); await second;
    expect(root.addData).toHaveBeenCalledTimes(2);
    expect(mocks.roots.at(-1)).toBe(root);
    expect(screen.getByLabelText("Atributos del elemento seleccionado")).toBeInTheDocument();
  });

  it("aborts stale filter drawing and never appends it to the replacement root", async () => {
    mocks.getLayers.mockResolvedValue([{ id: "CodigosFijos", label: "Códigos fijos", geometryType: "Point", srid: 4326 }]);
    mocks.getAllFixedCodeFeatures.mockImplementation((_filters: unknown, signal: AbortSignal, options: { pageSize: number; minimal: boolean; onPage: (page: any, count: number) => Promise<void> }) => new Promise((resolve, reject) => { mocks.requests.push({ signal, options, resolve, reject }); }));
    render(<MemoryRouter><MapPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.requests.length).toBeGreaterThan(0));
    const oldRequest = mocks.requests.at(-1)!;
    const oldRoot = mocks.roots.at(-1)!;
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "1" } });
    await waitFor(() => expect(mocks.requests.length).toBeGreaterThan(1));
    expect(oldRequest.signal.aborted).toBe(true);
    const current = mocks.requests.at(-1)!;
    const currentRoot = mocks.roots.at(-1)!;
    expect(currentRoot).not.toBe(oldRoot);
    await oldRequest.options.onPage({ features: [{ id: 90, geometry: null, properties: {} }] }, 1);
    expect(oldRoot.addData).not.toHaveBeenCalled();
    expect(currentRoot.addData).not.toHaveBeenCalled();
    current.reject(new Error("stopped"));
  });

  it("retains partial page results on failure and retry starts with an empty layer", async () => {
    mocks.getLayers.mockResolvedValue([{ id: "CodigosFijos", label: "Códigos fijos", geometryType: "Point", srid: 4326 }]);
    mocks.getAllFixedCodeFeatures.mockImplementation((_filters: unknown, signal: AbortSignal, options: { pageSize: number; minimal: boolean; onPage: (page: any, count: number) => Promise<void> }) => new Promise((resolve, reject) => { mocks.requests.push({ signal, options, resolve, reject }); }));
    render(<MemoryRouter><MapPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.requests.length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText("Nombre del propietario"), { target: { value: "Ana" } });
    await waitFor(() => expect(mocks.requests.length).toBeGreaterThan(1), { timeout: 1500 });
    const request = mocks.requests.at(-1)!; const root = mocks.roots.at(-1)!;
    let drawing!: Promise<void>;
    await act(async () => { drawing = request.options.onPage({ features: [{ id: 51, geometry: null, properties: { Nombre: "Ana" } }] }, 1); });
    await drawUntilAdded(root, 1); await drawing;
    request.reject(new Error("network interrupted"));
    expect(await screen.findByText(/Resultados incompletos: network interrupted/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ubicar Ana, código 51/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(mocks.requests.length).toBeGreaterThan(2));
    expect(mocks.roots.at(-1)).not.toBe(root);
    expect(mocks.roots.at(-1)!.addData).not.toHaveBeenCalled();
    mocks.requests.at(-1)!.reject(new Error("stop test"));
  });

  it("reports received versus drawn features when drawing fails midway and retry resets counts", async () => {
    mocks.getLayers.mockResolvedValue([{ id: "CodigosFijos", label: "Códigos fijos", geometryType: "Point", srid: 4326 }]);
    mocks.getAllFixedCodeFeatures.mockImplementation((_filters: unknown, signal: AbortSignal, options: { pageSize: number; minimal: boolean; onPage: (page: any, count: number) => Promise<void> }) => new Promise((resolve, reject) => {
      const request = { signal, options, resolve, reject };
      mocks.requests.push(request);
      const originalOnPage = options.onPage;
      options.onPage = async (page, count) => {
        try { await originalOnPage(page, count); } catch (error) { reject(error); throw error; }
      };
    }));
    render(<MemoryRouter><MapPage /></MemoryRouter>);
    await waitFor(() => expect(mocks.requests.length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText("Nombre del propietario"), { target: { value: "Ana" } });
    await waitFor(() => expect(mocks.requests.length).toBeGreaterThan(1));
    const request = mocks.requests.at(-1)!; const root = mocks.roots.at(-1)!;
    root.addData.mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw new Error("draw failed"); });
    const features = [51, 52, 53].map((id) => ({ id, geometry: null, properties: { Nombre: "Ana" } }));
    let drawing!: Promise<void>;
    await act(async () => { drawing = request.options.onPage({ features }, 3); });
    const rejected = expect(drawing).rejects.toThrow("draw failed");
    await drawUntilAdded(root, 2);
    await rejected;
    expect(await screen.findByText(/Resultados incompletos: draw failed/)).toBeInTheDocument();
    expect(screen.getByText(/3 códigos recibidos; 1 dibujados · mapa parcial/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ubicar.*51/ })).toBeInTheDocument();
    const previousRequestCount = mocks.requests.length;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(mocks.requests.length).toBeGreaterThan(previousRequestCount));
    const retry = mocks.requests.at(-1)!; const retryRoot = mocks.roots.at(-1)!;
    expect(retryRoot).not.toBe(root);
    expect(retryRoot.addData).not.toHaveBeenCalled();
    expect(screen.queryByText(/3 códigos recibidos/)).not.toBeInTheDocument();
    let retryDrawing!: Promise<void>;
    await act(async () => { retryDrawing = retry.options.onPage({ features }, 3); });
    await drawUntilAdded(retryRoot, 3);
    await retryDrawing;
    expect(retryRoot.addData).toHaveBeenCalledTimes(3);
    expect(screen.getByText(/3 códigos recibidos; 3 dibujados/)).toBeInTheDocument();
    await act(async () => { retry.resolve({ ...collection, features }); });
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
