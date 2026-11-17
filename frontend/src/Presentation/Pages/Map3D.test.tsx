import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Map3D, type Map3DHandle, type Map3DProps } from "./Map3D";

const engine = vi.hoisted(() => ({ maps: [] as any[], fail: false }));
vi.mock("maplibre-gl", () => ({
  setWorkerUrl: vi.fn(),
  Map: class {
    options: any;
    handlers = new Map<string, Set<(event?: any) => void>>();
    sources = new Map<string, any>();
    layers = new Map<string, any>();
    addControl = vi.fn(); remove = vi.fn(); resize = vi.fn();
    setBearing = vi.fn(); fitBounds = vi.fn(); zoomIn = vi.fn(); zoomOut = vi.fn();
    setTerrain = vi.fn(); triggerRepaint = vi.fn();
    getCenter = () => ({ lng: -60.97, lat: -16.39 });
    getZoom = () => 13; getBearing = () => 22;
    areTilesLoaded = () => true; isMoving = () => false; isStyleLoaded = () => true;
    setStyle = vi.fn();
    getCanvas = () => document.createElement("canvas");
    hits: any[] = [];
    queryRenderedFeatures = () => this.hits;
    constructor(options: any) {
      if (engine.fail) throw new Error("WebGL unavailable");
      this.options = options;
      engine.maps.push(this);
    }
    on(name: string, handler: (event?: any) => void) {
      if (!this.handlers.has(name)) this.handlers.set(name, new Set());
      this.handlers.get(name)!.add(handler);
      return this;
    }
    off(name: string, handler: (event?: any) => void) { this.handlers.get(name)?.delete(handler); return this; }
    emit(name: string, event?: any) { this.handlers.get(name)?.forEach((handler) => handler(event)); }
    addSource(id: string, spec: any) { this.sources.set(id, { ...spec, setData: vi.fn() }); }
    getSource(id: string) { return this.sources.get(id); }
    addLayer(layer: any) { this.layers.set(layer.id, layer); }
    getLayer(id: string) { return this.layers.get(id); }
    setPaintProperty = vi.fn(); setLayoutProperty = vi.fn();
  },
  NavigationControl: class {},
}));
const point = { type: "Feature" as const, id: 42, geometry: { type: "Point" as const, coordinates: [-60.97, -16.39] }, properties: { Estado: 2, Nombre: "Ana" } };
const props = (): Map3DProps => ({
  camera: { longitude: -60.97, latitude: -16.39, zoom: 14 }, bearing: -18,
  basemap: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "OSM" },
  layers: [{ id: "CodigosFijos", label: "Códigos fijos", geometryType: "Point", srid: 4326 }],
  data: { CodigosFijos: { type: "FeatureCollection", features: [point] } },
  palette: { "state-2": "#f97316", "state-unknown": "#64748b", CodigosFijos: "#e11d48" },
  selected: null, target: null, extent: null,
  onSelect: vi.fn(), onClear: vi.fn(), onCameraChange: vi.fn(), onBearingChange: vi.fn(), onFallback: vi.fn(),
});
async function loadMap() {
  await waitFor(() => expect(engine.maps).toHaveLength(1));
  await act(async () => engine.maps[0].emit("load"));
  return engine.maps[0];
}
beforeEach(() => { vi.restoreAllMocks(); engine.maps = []; engine.fail = false; });

describe("real 3D map", () => {
  it("uses an actual pitched camera and Terrarium DEM at natural elevation, not CSS", async () => {
    render(<Map3D {...props()} />);
    const map = await loadMap();
    expect(map.options).toMatchObject({ center: [-60.97, -16.39], zoom: 13, pitch: 60, bearing: -18, canvasContextAttributes: { preserveDrawingBuffer: true } });
    expect(map.options.style.sources.terrain).toMatchObject({ type: "raster-dem", encoding: "terrarium", maxzoom: 15 });
    expect(map.options.style.terrain).toEqual({ source: "terrain", exaggeration: 1 });
    expect(screen.getByLabelText("Mapa 3D interactivo").style.transform).toBe("");
    expect(map.getSource("CodigosFijos").data.features[0]).toEqual(point);
    expect(map.getLayer("CodigosFijos-points").paint["circle-color"]).toContain("#f97316");
  });

  it("updates shared layers/colors and hydrates selection through the existing callback", async () => {
    const p = props();
    const view = render(<Map3D {...p} />);
    const map = await loadMap();
    map.hits = [{ source: "CodigosFijos", id: 42 }];
    act(() => map.emit("click", { point: { x: 20, y: 30 } }));
    expect(p.onSelect).toHaveBeenCalledWith(point, p.layers[0]);
    map.hits = []; act(() => map.emit("click", { point: { x: 0, y: 0 } }));
    expect(p.onClear).toHaveBeenCalledOnce();
    map.isStyleLoaded = () => false; // Tile loading must not discard a newly downloaded page.
    const data = { CodigosFijos: { type: "FeatureCollection" as const, features: [point, { ...point, id: 43 }] } };
    view.rerender(<Map3D {...p} data={data} layers={[]} palette={{ ...p.palette, "state-2": "#123456" }} />);
    expect(map.getSource("CodigosFijos").setData).toHaveBeenCalledWith(data.CodigosFijos);
    expect(map.setPaintProperty).toHaveBeenCalledWith("CodigosFijos-points", "circle-color", expect.arrayContaining(["#123456"]));
    expect(map.setLayoutProperty).toHaveBeenCalledWith("CodigosFijos-points", "visibility", "none");
    expect(engine.maps).toHaveLength(1);
  });

  it("returns camera position using the 256/512 tile zoom conversion and disposes its engine", async () => {
    const p = props(); const view = render(<Map3D {...p} />);
    const map = await loadMap();
    act(() => map.emit("moveend"));
    expect(p.onCameraChange).toHaveBeenCalledWith({ longitude: -60.97, latitude: -16.39, zoom: 14 });
    expect(p.onBearingChange).toHaveBeenCalledWith(22);
    view.unmount();
    expect(map.remove).toHaveBeenCalledOnce();
  });

  it("preserves fractional rotation from the camera without rounding or feeding it back", async () => {
    const initial = props();
    function ControlledMap() {
      const [bearing, setBearing] = useState(initial.bearing);
      return <Map3D {...initial} bearing={bearing} onBearingChange={setBearing} />;
    }
    render(<ControlledMap />); const map = await loadMap();
    let actual = 22.35;
    map.getBearing = () => actual;
    map.setBearing.mockClear();
    map.setBearing.mockImplementation((value: number) => { actual = value; });
    act(() => map.emit("moveend"));
    expect(actual).toBe(22.35);
    expect(map.setBearing).not.toHaveBeenCalled();
  });

  it("treats -180 and 180 as the same camera orientation", async () => {
    const p = props(); const view = render(<Map3D {...p} />); const map = await loadMap();
    map.getBearing = () => -180;
    map.setBearing.mockClear();
    view.rerender(<Map3D {...p} bearing={180} />);
    expect(map.setBearing).not.toHaveBeenCalled();
    view.rerender(<Map3D {...p} bearing={179.9} />);
    expect(map.setBearing).toHaveBeenCalledExactlyOnceWith(179.9);
  });

  it("offers 2D when WebGL cannot initialize, without breaking the page", async () => {
    engine.fail = true; const p = props();
    render(<Map3D {...p} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/WebGL/);
    fireEvent.click(screen.getByRole("button", { name: "Volver a vista 2D" }));
    expect(p.onFallback).toHaveBeenCalledOnce();
  });

  it("reports failed terrain instead of silently pretending the surface has elevation", async () => {
    render(<Map3D {...props()} />); const map = await loadMap();
    act(() => map.emit("error", { sourceId: "terrain", error: new Error("offline") }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/relieve/);
    expect(map.setTerrain).toHaveBeenCalledWith(null);
  });

  it("captures a rendered WebGL frame with attribution, and waits for tiles", async () => {
    const ctx = { font: "", fillStyle: "", measureText: (text: string) => ({ width: text.length * 6 }), fillRect: vi.fn(), drawImage: vi.fn(), fillText: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as any);
    const ref = createRef<Map3DHandle>();
    render(<Map3D {...props()} ref={ref} />); const map = await loadMap();
    Object.defineProperty(screen.getByLabelText("Mapa 3D interactivo"), "clientWidth", { value: 300 });
    map.areTilesLoaded = () => false;
    const capture = ref.current!.capture();
    act(() => map.emit("render"));
    expect(ctx.drawImage).not.toHaveBeenCalled();
    map.areTilesLoaded = () => true;
    act(() => map.emit("render"));
    const canvas = await capture;
    expect(canvas.width).toBe(300);
    expect(ctx.drawImage).toHaveBeenCalledOnce();
    expect(ctx.fillText.mock.calls.map((call) => call[0]).join(" ")).toContain("OSM");
    expect(ctx.fillText.mock.calls.map((call) => call[0]).join(" ")).toContain("USGS");
    expect(map.handlers.get("render").size).toBe(0);
  });

  it("rebuilds overlays after a basemap change without creating another camera", async () => {
    const p = props(); const view = render(<Map3D {...p} />); const map = await loadMap();
    view.rerender(<Map3D {...p} basemap={{}} />);
    expect(map.setStyle).toHaveBeenCalledWith(expect.objectContaining({ terrain: { source: "terrain", exaggeration: 1 } }));
    act(() => map.emit("style.load"));
    expect(map.getSource("CodigosFijos").setData).toHaveBeenCalled();
    expect(engine.maps).toHaveLength(1);
  });

  it("refuses a capture before the map loads", async () => {
    const ref = createRef<Map3DHandle>();
    render(<Map3D {...props()} ref={ref} />);
    await expect(ref.current!.capture()).rejects.toThrow(/cargar/);
  });
});
