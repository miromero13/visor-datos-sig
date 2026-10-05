import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, Pane, TileLayer, useMap } from "react-leaflet";
import { useSearchParams } from "react-router-dom";
import L from "leaflet";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import { Camera, Crosshair, Maximize, Printer, Plus, Minus, ChevronDown } from "lucide-react";
import { AuthenticatedLayout } from "@/Presentation/Layouts/AuthenticatedLayout";
import { getLayerExtent, getLayerFeatures, getAllFixedCodeFeatures, getLayers, searchLayer, type Extent, type Feature, type FeatureCollection, type Layer, type LayerId, type SearchResult } from "@/Application/Services/layers";
import "leaflet/dist/leaflet.css";

const colors: Record<LayerId, string> = { CodigosFijos: "#e11d48", Lotes: "#0ea5e9", Manzanas: "#7c3aed", Vias: "#f59e0b" };
const fixedStates = [
  { value: 1, label: "Normal", color: "#16a34a" },
  { value: 2, label: "Para corte", color: "#f97316" },
  { value: 3, label: "Cortado", color: "#dc2626" },
  { value: 4, label: "Baja parcial", color: "#8b5cf6" },
  { value: 5, label: "Baja total", color: "#6b7280" },
];
const defaultPalette: Record<string, string> = {
  ...colors,
  ...Object.fromEntries(fixedStates.map((state) => [`state-${state.value}`, state.color])),
  "state-unknown": "#64748b",
};
const paletteStorageKey = "sig.map-colors.v1";
const PaletteContext = createContext(defaultPalette);
const fixedStateColor = (value: unknown, palette: Record<string, string>) =>
  palette[fixedStates.some((state) => Number(value) === state.value) ? `state-${Number(value)}` : "state-unknown"];
function loadPalette(): Record<string, string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(paletteStorageKey) ?? "null");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return { ...defaultPalette };
    return Object.fromEntries(Object.entries(defaultPalette).map(([key, fallback]) => {
      const value = (saved as Record<string, unknown>)[key];
      return [key, typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback];
    }));
  } catch {
    return { ...defaultPalette };
  }
}
type BasemapId = "osm" | "opentopomap" | "satellite" | "carto-light" | "carto-dark" | "no-labels" | "none";
type Basemap = { label: string; url?: string; attribution?: string };
const cartoBasemapKey = (import.meta.env.VITE_CARTO_BASEMAP_KEY ?? "").trim();
const withCartoKey = (url: string) => (cartoBasemapKey ? `${url}?key=${encodeURIComponent(cartoBasemapKey)}` : url);
const basemaps: Record<BasemapId, Basemap> = {
  osm: { label: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
  opentopomap: { label: "OpenTopoMap", url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://www2.jpl.nasa.gov/srtm/">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org/">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)' },
  satellite: { label: "Imágenes satelitales", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community' },
  "carto-light": { label: "Cartografía clara", url: withCartoKey("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"), attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' },
  "carto-dark": { label: "Cartografía oscura", url: withCartoKey("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"), attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' },
  "no-labels": { label: "Base sin etiquetas", url: withCartoKey("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"), attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' },
  none: { label: "Sin mapa base" },
};
const MAX_MAP_ZOOM = 17;
const FIXED_CODES_PANE = "fixed-codes-overlay";
const allowedLayerIds = new Set<LayerId>(["CodigosFijos", "Lotes", "Manzanas", "Vias"]);
const layerMenuOrder: LayerId[] = ["Vias", "Manzanas", "Lotes", "CodigosFijos"];
const layerRenderOrder: LayerId[] = ["Vias", "Manzanas", "Lotes", "CodigosFijos"];
const initialMapCenter: L.LatLngExpression = [-16.39, -60.97];
function MapToolbarControl({ extent, fullscreen, toggleFullscreen, printMap, exportPng }: { extent: Extent | null; fullscreen: boolean; toggleFullscreen: () => void; printMap: () => void; exportPng: () => void }) {
  const map = useMap();
  const handlers = useRef({ extent, fullscreen, toggleFullscreen, printMap, exportPng });
  handlers.current = { extent, fullscreen, toggleFullscreen, printMap, exportPng };
  useEffect(() => {
    const control = new L.Control({ position: "topleft" });
    const roots: ReturnType<typeof createRoot>[] = [];
    const buttons: HTMLButtonElement[] = [];
    const icons = [<Plus size={18} aria-hidden="true" />, <Minus size={18} aria-hidden="true" />, <Crosshair size={18} aria-hidden="true" />, <Maximize size={17} aria-hidden="true" />, <Printer size={17} aria-hidden="true" />, <Camera size={17} aria-hidden="true" />];
    const labels = ["Acercar mapa", "Alejar mapa", "Centrar mapa", "Pantalla completa", "Imprimir vista actual", "Exportar vista actual como PNG"];
    const refresh = () => {
      buttons.forEach((button, index) => {
        const label = index === 3 && handlers.current.fullscreen ? "Salir de pantalla completa" : labels[index];
        button.setAttribute("aria-label", label);
        button.setAttribute("data-tooltip", label);
        button.disabled = index < 2 && (index === 0 ? map.getZoom() >= map.getMaxZoom() : map.getZoom() <= map.getMinZoom());
      });
    };
    control.onAdd = () => {
      const root = L.DomUtil.create("div", "leaflet-bar map-toolbar-control");
      const actions = [
        () => map.zoomIn(),
        () => map.zoomOut(),
        () => {
          const bounds = L.latLngBounds([]);
          map.eachLayer((layer) => {
            if (layer instanceof L.GeoJSON) {
              const layerBounds = layer.getBounds();
              if (layerBounds.isValid()) bounds.extend(layerBounds);
            }
          });
          const currentExtent = handlers.current.extent;
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: MAX_MAP_ZOOM });
          else if (currentExtent)
            map.fitBounds(
              [
                [currentExtent.south, currentExtent.west],
                [currentExtent.north, currentExtent.east],
              ],
              { padding: [28, 28], maxZoom: MAX_MAP_ZOOM },
            );
          else map.setView(initialMapCenter, Math.min(map.getZoom(), MAX_MAP_ZOOM));
        },
        () => handlers.current.toggleFullscreen(),
        () => handlers.current.printMap(),
        () => handlers.current.exportPng(),
      ];
      buttons.length = 0;
      actions.forEach((action, index) => {
        const button = L.DomUtil.create("button", "", root);
        button.type = "button";
        buttons.push(button);
        const reactRoot = createRoot(button);
        roots.push(reactRoot);
        reactRoot.render(icons[index]);
        L.DomEvent.on(button, "click", (event) => {
          L.DomEvent.stopPropagation(event);
          action();
        });
      });
      refresh();
      L.DomEvent.disableClickPropagation(root);
      L.DomEvent.disableScrollPropagation(root);
      return root;
    };
    control.addTo(map);
    map.on("zoomend", refresh);
    return () => {
      map.off("zoomend", refresh);
      roots.forEach((root) => root.unmount());
      control.remove();
    };
  }, [map]);
  return null;
}
function MapClickHandler({ onEmptyClick }: { onEmptyClick: () => void }) {
  const map = useMap();
  useEffect(() => {
    map.on("click", onEmptyClick);
    return () => {
      map.off("click", onEmptyClick);
    };
  }, [map, onEmptyClick]);
  return null;
}
function combinedGeoJsonBounds(collections: Partial<Record<LayerId, FeatureCollection>>) {
  const bounds = L.latLngBounds([]);
  for (const data of Object.values(collections)) {
    if (!data) continue;
    const layerBounds = L.geoJSON(data).getBounds();
    if (layerBounds.isValid()) bounds.extend(layerBounds);
  }
  return bounds;
}
function LoadedDataFit({ collections, target }: { collections: Partial<Record<LayerId, FeatureCollection>>; target: SearchResult | null }) {
  const map = useMap();
  useEffect(() => {
    let frame = 0;
    frame = requestAnimationFrame(() => {
      const container = map.getContainer();
      if (container.clientWidth <= 0 || container.clientHeight <= 0) return;
      map.invalidateSize({ pan: false });
      if (target?.geometry) {
        const targetBounds = L.geoJSON(target.geometry).getBounds();
        if (targetBounds.isValid()) {
          map.fitBounds(targetBounds, { padding: [45, 45], maxZoom: MAX_MAP_ZOOM });
          return;
        }
      }
      const bounds = combinedGeoJsonBounds(collections);
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: MAX_MAP_ZOOM });
    });
    return () => cancelAnimationFrame(frame);
  }, [collections, map, target]);
  return null;
}
function MapSizeSynchronizer({ extent, target, collections }: { extent: Extent | null; target: SearchResult | null; collections: Partial<Record<LayerId, FeatureCollection>> }) {
  const map = useMap();
  const lastSize = useRef<[number, number] | null>(null);
  const fitCurrentView = useCallback(() => {
    if (target?.geometry) {
      const bounds = L.geoJSON(target.geometry).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: MAX_MAP_ZOOM });
        return;
      }
    }
    const bounds = combinedGeoJsonBounds(collections);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: MAX_MAP_ZOOM });
    else if (extent)
      map.fitBounds(
        [
          [extent.south, extent.west],
          [extent.north, extent.east],
        ],
        { padding: [28, 28], maxZoom: MAX_MAP_ZOOM },
      );
  }, [collections, extent, map, target]);
  useEffect(() => {
    const container = map.getContainer();
    let frame = 0;
    let disposed = false;
    const synchronize = () => {
      if (disposed) return;
      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0 || (lastSize.current?.[0] === width && lastSize.current[1] === height)) return;
      lastSize.current = [width, height];
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed) return;
        map.invalidateSize({ pan: false });
        fitCurrentView();
      });
    };
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(synchronize);
      observer.observe(container);
      synchronize();
      return () => {
        disposed = true;
        observer.disconnect();
        cancelAnimationFrame(frame);
      };
    }
    const scheduleCheck = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(synchronize);
    };
    window.addEventListener("resize", scheduleCheck);
    synchronize();
    return () => {
      disposed = true;
      window.removeEventListener("resize", scheduleCheck);
      cancelAnimationFrame(frame);
    };
  }, [fitCurrentView, map]);
  return null;
}
function MapView({ target, targetLayer, fixedRenderer }: { target: SearchResult | null; targetLayer: LayerId | null; fixedRenderer: L.Renderer }) {
  const palette = useContext(PaletteContext);
  const map = useMap();
  const geoJson = useRef<L.GeoJSON | null>(null);
  useZoomSizing(geoJson, 5, 10, target);
  useEffect(() => {
    if (!target?.geometry) return;
    const bounds = L.geoJSON(target.geometry).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [45, 45], maxZoom: MAX_MAP_ZOOM });
  }, [target, map]);
  if (!target?.geometry) return null;
  const isFixedCode = targetLayer === "CodigosFijos";
  const color = isFixedCode ? fixedStateColor(target.properties.Estado, palette) : palette[targetLayer ?? target.layer] ?? "#16a34a";
  return (
    <GeoJSON
      ref={geoJson}
      key={`${target.id}-${target.geometry.type}`}
      data={{ type: "Feature", geometry: target.geometry, properties: target.properties } as GeoJSON.Feature}
      pane={isFixedCode ? FIXED_CODES_PANE : undefined}
      style={{ color, weight: 5 * zoomScale(map.getZoom()), fillColor: color, fillOpacity: isFixedCode ? 0.35 : 0.4 }}
      pointToLayer={(_, latlng) => L.circleMarker(latlng, { pane: isFixedCode ? FIXED_CODES_PANE : "markerPane", renderer: isFixedCode ? fixedRenderer : undefined, radius: 10 * zoomScale(map.getZoom()), color, weight: 5 * zoomScale(map.getZoom()), fillColor: color, fillOpacity: isFixedCode ? 0.45 : 0.8 })}
      onEachFeature={(_, layer) => layer.on("click", (event) => L.DomEvent.stopPropagation(event))}
    />
  );
}
function zoomScale(zoom: number) {
  return Math.max(0.03, Math.min(0.8, 2 ** ((zoom - 17) / 2)));
}
function useZoomSizing(geoJson: { current: L.GeoJSON | null }, weight: number, radius: number, content: unknown) {
  const map = useMap();
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const scale = zoomScale(map.getZoom());
      const resize = (child: L.Layer) => {
        if (child instanceof L.Path) child.setStyle({ weight: weight * scale });
        if (child instanceof L.CircleMarker) child.setRadius(radius * scale);
        if (child instanceof L.LayerGroup) child.eachLayer(resize);
      };
      geoJson.current?.eachLayer(resize);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    map.on("zoom", schedule);
    update();
    return () => {
      map.off("zoom", schedule);
      cancelAnimationFrame(frame);
    };
  }, [map, geoJson, weight, radius, content]);
}
function ZoomStyledGeoJSON({ layer, data, onSelect }: { layer: Layer; data: GeoJSON.FeatureCollection; onSelect: (feature: Feature) => void }) {
  const palette = useContext(PaletteContext);
  const map = useMap();
  const geoJson = useRef<L.GeoJSON | null>(null);
  const isFixedCodes = layer.id === "CodigosFijos";
  const renderer = useMemo(() => (isFixedCodes ? L.canvas({ pane: FIXED_CODES_PANE }) : undefined), [isFixedCodes]);
  useZoomSizing(geoJson, layer.id === "Vias" ? 3 : 1.5, 5, data);
  return (
    <GeoJSON
      ref={geoJson}
      data={data}
      pane={isFixedCodes ? FIXED_CODES_PANE : undefined}
      style={(feature) => {
        const scale = zoomScale(map.getZoom());
        const color = layer.id === "CodigosFijos" ? fixedStateColor(feature?.properties?.Estado, palette) : palette[layer.id];
        return { color, weight: (layer.id === "Vias" ? 3 : 1.5) * scale, fillColor: color, fillOpacity: layer.id === "CodigosFijos" ? 0.85 : 0.22 };
      }}
      pointToLayer={(feature, latlng) => {
        const color = layer.id === "CodigosFijos" ? fixedStateColor(feature.properties?.Estado, palette) : palette[layer.id];
        return L.circleMarker(latlng, { pane: isFixedCodes ? FIXED_CODES_PANE : "markerPane", renderer, radius: 5 * zoomScale(map.getZoom()), weight: (layer.id === "Vias" ? 3 : 1.5) * zoomScale(map.getZoom()), color, fillColor: color, fillOpacity: 0.9 });
      }}
      onEachFeature={(feature, leafletLayer) =>
        leafletLayer.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          onSelect(feature as unknown as Feature);
        })
      }
    />
  );
}

export function MapPage() {
  const [palette, setPalette] = useState(loadPalette);
  const [paletteStorageError, setPaletteStorageError] = useState(false);
  const changeColor = (key: string, color: string) => {
    const next = { ...palette, [key]: color };
    setPalette(next);
    try {
      localStorage.setItem(paletteStorageKey, JSON.stringify(next));
      setPaletteStorageError(false);
    } catch {
      setPaletteStorageError(true);
    }
  };
  const colorPicker = (key: string, label: string) => (
    <input
      type="color"
      value={palette[key]}
      aria-label={`Color de ${label}`}
      title={`Cambiar color de ${label}`}
      className="h-8 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
      onChange={(event) => changeColor(key, event.target.value)}
    />
  );
  const [searchParams] = useSearchParams();
  const requestedLayer = searchParams.get("layer");
  const requestedId = searchParams.get("id");
  const selectedRouteLayer = requestedLayer && allowedLayerIds.has(requestedLayer as LayerId) ? (requestedLayer as LayerId) : null;
  const selectedRouteId = requestedId && /^\d+$/.test(requestedId) && Number.isSafeInteger(Number(requestedId)) ? Number(requestedId) : null;
  const [basemapId, setBasemapId] = useState<BasemapId>("osm");
  const [sidebarTab, setSidebarTab] = useState("search");
  const sidebarTabs = [
    { id: "search", label: "Buscar" },
    { id: "layers", label: "Capas" },
    { id: "legend", label: "Leyenda" },
  ];
  const workspaceRef = useRef<HTMLDivElement>(null);
  const mapCanvasRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [exportError, setExportError] = useState("");
  const [printImage, setPrintImage] = useState<string | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [visible, setVisible] = useState<Set<LayerId>>(new Set());
  const [data, setData] = useState<Partial<Record<LayerId, FeatureCollection>>>({});
  const [fixedData, setFixedData] = useState<FeatureCollection | null>(null);
  const [fixedEstado, setFixedEstado] = useState("");
  const [fixedNombreInput, setFixedNombreInput] = useState("");
  const [fixedNombre, setFixedNombre] = useState("");
  const [fixedLoading, setFixedLoading] = useState(false);
  const [fixedError, setFixedError] = useState("");
  const [selected, setSelected] = useState<{ layer: Layer; feature: Feature } | null>(null);
  const [extent, setExtent] = useState<Extent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<SearchResult | null>(null);
  useEffect(() => {
    let cancelled = false;
    getLayers()
      .then(async (items) => {
        if (cancelled) return;
        setLayers(items);
        setVisible(new Set(items.map((x) => x.id)));
        if (items.length) {
          const results = await Promise.allSettled(items.map((item) => getLayerExtent(item.id)));
          const successfulExtents = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
          if (!cancelled) {
            if (successfulExtents.length) {
              setExtent({ west: Math.min(...successfulExtents.map((item) => item.west)), south: Math.min(...successfulExtents.map((item) => item.south)), east: Math.max(...successfulExtents.map((item) => item.east)), north: Math.max(...successfulExtents.map((item) => item.north)), srid: successfulExtents[0].srid });
            } else {
              const failure = results.find((result) => result.status === "rejected");
              setError(failure?.status === "rejected" && failure.reason instanceof Error ? failure.reason.message : "No se pudo obtener la extensión.");
            }
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "No se pudieron cargar las capas.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const missing = [...visible].filter((id) => id !== "CodigosFijos" && !data[id]);
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(missing.map(async (id) => [id, await getLayerFeatures(id)] as const))
      .then((results) => {
        if (!cancelled) setData((previous) => ({ ...previous, ...Object.fromEntries(results) }));
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, data]);
  useEffect(() => {
    const timer = window.setTimeout(() => setFixedNombre(fixedNombreInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [fixedNombreInput]);
  useEffect(() => {
    if (!visible.has("CodigosFijos")) return;
    let cancelled = false;
    const controller = new AbortController();
    setFixedLoading(true);
    setFixedError("");
    setFixedData(null);
    if (selected?.layer.id === "CodigosFijos") {
      setSelected(null);
      setTarget(null);
    }
    getAllFixedCodeFeatures({ estado: fixedEstado ? Number(fixedEstado) : undefined, nombre: fixedNombre }, controller.signal)
      .then((result) => {
        if (!cancelled) setFixedData(result);
      })
      .catch((e) => {
        if (!cancelled && e?.name !== "AbortError") setFixedError(e instanceof Error ? e.message : "No se pudieron cargar los códigos fijos.");
      })
      .finally(() => {
        if (!cancelled) setFixedLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fixedEstado, fixedNombre, visible]);
  useEffect(() => {
    if (!selectedRouteLayer || selectedRouteId === null) return;
    let cancelled = false;
    setError("");
    setTarget(null);
    setSelected(null);
    const idField: Record<LayerId, string> = { CodigosFijos: "IdCodigo", Lotes: "IdLote", Manzanas: "IdManzana", Vias: "IdVia" };
    searchLayer(selectedRouteLayer, "", { [idField[selectedRouteLayer]]: String(selectedRouteId) }, 1)
      .then((result) => {
        if (cancelled) return;
        const item = result.data.items.find((candidate) => candidate.id === selectedRouteId);
        if (!item) {
          setError("No se encontró la entidad solicitada en esta capa.");
          return;
        }
        const layer = layers.find((candidate) => candidate.id === selectedRouteLayer);
        if (layer) {
          setTarget(item);
          setSelected({ layer, feature: item as Feature });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "No se pudo cargar la entidad.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRouteLayer, selectedRouteId, layers]);
  const setLayerVisible = useCallback((id: LayerId, checked: boolean) => {
    setVisible((previous) => {
      const next = new Set(previous);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);
  const activeLayers = useMemo(() => layerRenderOrder.flatMap((id) => layers.filter((layer) => layer.id === id && visible.has(id))), [layers, visible]);
  const fixedRenderer = useMemo(() => L.canvas({ pane: FIXED_CODES_PANE }), []);
  const orderedLayers = useMemo(() => layerMenuOrder.flatMap((id) => layers.filter((layer) => layer.id === id)), [layers]);
  const visibleCollections = useMemo(
    () =>
      Object.fromEntries(
        activeLayers.flatMap((layer) => {
          const collection = layer.id === "CodigosFijos" ? fixedData : data[layer.id];
          return collection ? [[layer.id, collection]] : [];
        }),
      ) as Partial<Record<LayerId, FeatureCollection>>,
    [activeLayers, data, fixedData],
  );
  useEffect(() => {
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === workspaceRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === workspaceRef.current) await document.exitFullscreen();
      else await workspaceRef.current?.requestFullscreen();
    } catch {
      setExportError("No se pudo activar la pantalla completa en este navegador.");
    }
  };
  const captureMap = async () => {
    const mapCanvas = mapCanvasRef.current;
    if (!mapCanvas) throw new Error("No se encontró el mapa para capturar.");
    mapCanvas.classList.add("map-canvas-exporting");
    try {
      return await html2canvas(mapCanvas, { useCORS: true, allowTaint: false, scale: window.devicePixelRatio || 1, backgroundColor: "#ffffff", ignoreElements: (element) => element.classList.contains("map-toolbar-control") });
    } finally {
      mapCanvas.classList.remove("map-canvas-exporting");
    }
  };
  const exportPng = async () => {
    setExportError("");
    try {
      const canvas = await captureMap();
      const link = document.createElement("a");
      link.download = "visor-mapa.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      setExportError("No se pudo exportar el mapa. Es posible que el mapa base o alguna capa bloquee la captura por CORS.");
    }
  };
  const printMap = async () => {
    setExportError("");
    let cleanup: (() => void) | undefined;
    try {
      const canvas = await captureMap();
      const dataUrl = canvas.toDataURL("image/png");
      setPrintImage(dataUrl);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
      cleanup = () => setPrintImage(null);
      window.addEventListener("afterprint", cleanup, { once: true });
      window.print();
    } catch {
      if (cleanup) window.removeEventListener("afterprint", cleanup);
      setPrintImage(null);
      setExportError("No se pudo preparar la captura del mapa para imprimir.");
    }
  };
  const selectMap = (feature: Feature, layer: Layer) => {
    setSelected({ layer, feature });
    setTarget(null);
  };
  const clearSelection = useCallback(() => {
    setSelected(null);
    setTarget(null);
  }, []);
  return (
    <PaletteContext.Provider value={palette}>
    <AuthenticatedLayout activeItem="Visor de mapa">
      <main className="map-page">
        <div className="map-heading">
          <div>
            <p className="map-eyebrow">INFORMACIÓN TERRITORIAL</p>
            <h1>Visor de mapa</h1>
            <p>Explorá las capas geográficas disponibles.</p>
          </div>
          <span className="map-coordinate-note">Sistema de coordenadas · WGS 84</span>
        </div>
        {error && (
          <div className="map-alert" role="alert">
            {error}
          </div>
        )}
        {exportError && (
          <div className="map-alert" role="alert">
            {exportError}
          </div>
        )}
        {printImage && (
          <div className="map-print-overlay">
            <img src={printImage} alt="Vista actual del mapa" />
          </div>
        )}
        <div className="map-workspace" ref={workspaceRef}>
          <section className="map-canvas" ref={mapCanvasRef} aria-label="Mapa interactivo">
            <MapContainer center={initialMapCenter} zoom={12} maxZoom={MAX_MAP_ZOOM} zoomControl={false} scrollWheelZoom preferCanvas className="leaflet-map">
              <Pane name={FIXED_CODES_PANE} style={{ zIndex: 625 }} />
              <MapClickHandler onEmptyClick={clearSelection} />
              <MapToolbarControl extent={extent} fullscreen={fullscreen} toggleFullscreen={() => void toggleFullscreen()} printMap={() => void printMap()} exportPng={() => void exportPng()} />
              <MapSizeSynchronizer extent={extent} target={target} collections={visibleCollections} />
              <LoadedDataFit collections={visibleCollections} target={target} />
              {basemaps[basemapId].url && <TileLayer key={basemapId} attribution={basemaps[basemapId].attribution} url={basemaps[basemapId].url} crossOrigin="anonymous" />}
              <MapView target={target} targetLayer={selected?.layer.id ?? target?.layer ?? null} fixedRenderer={fixedRenderer} />
              {activeLayers.map((layer) => {
                const collection = layer.id === "CodigosFijos" ? fixedData : data[layer.id];
                if (!collection) return null;
                return <ZoomStyledGeoJSON key={`${layer.id}-${layer.id === "CodigosFijos" ? `${fixedEstado}-${fixedNombre}` : "all"}`} layer={layer} data={collection as GeoJSON.FeatureCollection} onSelect={(feature) => selectMap(feature, layer)} />;
              })}
            </MapContainer>
            {!loading && activeLayers.length > 0 && activeLayers.every((layer) => (layer.id === "CodigosFijos" ? fixedData : data[layer.id])?.features.length === 0) && <div className="map-empty">No hay elementos geográficos para mostrar.</div>}
            {selected && (
              <aside className="map-feature-card" aria-label="Atributos del elemento seleccionado">
                <div className="map-feature-card-heading">
                  <div>
                    <h2>Detalle</h2>
                    <p className="map-detail-layer">{selected.layer.label}</p>
                  </div>
                  <button
                    type="button"
                    className="map-feature-card-close"
                    aria-label="Cerrar detalle del elemento"
                    onClick={() => {
                      setSelected(null);
                      setTarget(null);
                    }}
                  >
                    ×
                  </button>
                </div>
                <dl>
                  {Object.entries(selected.feature.properties).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value == null ? "—" : String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </aside>
            )}
          </section>
          <aside className="map-sidebar" aria-label="Controles del mapa">
            <div role="tablist" aria-label="Secciones del panel" className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
              {sidebarTabs.map((tab, index) => (
                <button
                  key={tab.id}
                  id={`map-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === tab.id}
                  aria-controls={`map-panel-${tab.id}`}
                  tabIndex={sidebarTab === tab.id ? 0 : -1}
                  className={`min-h-11 rounded-md px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${sidebarTab === tab.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}
                  onClick={() => setSidebarTab(tab.id)}
                  onKeyDown={(event) => {
                    let next = index;
                    if (event.key === "ArrowRight") next = (index + 1) % sidebarTabs.length;
                    else if (event.key === "ArrowLeft") next = (index + sidebarTabs.length - 1) % sidebarTabs.length;
                    else if (event.key === "Home") next = 0;
                    else if (event.key === "End") next = sidebarTabs.length - 1;
                    else return;
                    event.preventDefault();
                    setSidebarTab(sidebarTabs[next].id);
                    document.getElementById(`map-tab-${sidebarTabs[next].id}`)?.focus();
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div id="map-panel-search" role="tabpanel" aria-labelledby="map-tab-search" hidden={sidebarTab !== "search"}>
              <section className="map-sidebar-section map-search-section" aria-labelledby="map-search-heading">
                <h2 id="map-search-heading">Buscar código fijo</h2>
                <label htmlFor="fixed-state">Estado</label>
                <span className="relative block">
                  <select id="fixed-state" className="block h-11 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 [&>option]:cursor-pointer" value={fixedEstado} onChange={(event) => setFixedEstado(event.target.value)}>
                    <option value="">Todos los estados</option>

                    {fixedStates.map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.label}
                      </option>
                    ))}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} aria-hidden="true" />
                </span>
                <label htmlFor="fixed-owner">Nombre del propietario</label>
                <input id="fixed-owner" className="map-fixed-owner placeholder:text-sm text-sm! [&::-webkit-search-cancel-button]:cursor-pointer" type="search" value={fixedNombreInput} onChange={(event) => setFixedNombreInput(event.target.value)} placeholder="Buscar nombre…" />
              </section>
              <section className="map-sidebar-section map-results-section" aria-labelledby="map-results-heading">
                <h2 id="map-results-heading">Resultados</h2>
                <p className="map-muted">Seleccioná un resultado para ubicarlo en el mapa.</p>
                {!visible.has("CodigosFijos") ? (
                  <p className="map-muted" role="status">
                    La capa Códigos fijos está oculta. Activala en la pestaña Capas para buscar y ver resultados.
                  </p>
                ) : fixedNombreInput.trim() !== fixedNombre ? (
                  <p className="map-muted" role="status">
                    Escribí un nombre para buscar, o filtrá por estado.
                  </p>
                ) : fixedLoading ? (
                  <p role="status">Cargando códigos fijos…</p>
                ) : fixedError ? (
                  <p className="map-filter-error" role="alert">
                    {fixedError}
                  </p>
                ) : fixedData?.features.length === 0 ? (
                  <p className="map-muted" role="status">
                    No hay códigos fijos con estos filtros.
                  </p>
                ) : fixedData && (fixedNombre || fixedEstado) ? (
                  <>
                    <p className="map-result-count" role="status">
                      {fixedData.features.length} códigos encontrados
                    </p>
                    <ul className="map-result-list" aria-label="Resultados de códigos fijos">
                      {fixedData.features.map((feature) => {
                        const state = fixedStates.find((item) => item.value === Number(feature.properties.Estado));
                        const code = feature.properties.CodFijo ?? feature.properties.CodF_SIG ?? feature.properties.CodF_SQL ?? feature.id;
                        const isSelected = selected?.layer.id === "CodigosFijos" && selected.feature.id === feature.id;
                        return (
                          <li key={feature.id}>
                            <button
                              type="button"
                              className={`map-result-button ${isSelected ? "is-selected" : ""}`}
                              aria-label={`Ubicar ${String(feature.properties.Nombre ?? "Sin nombre")}, código ${String(code)}, estado ${state?.label ?? "Estado desconocido"}`}
                              aria-pressed={isSelected}
                              onClick={() => {
                                const fixedLayer = layers.find((candidate) => candidate.id === "CodigosFijos");
                                if (!fixedLayer) {
                                  setFixedError("No se encontró la capa de códigos fijos.");
                                  return;
                                }
                                setSelected({ layer: fixedLayer, feature });
                                setTarget({ ...feature, layer: "CodigosFijos" });
                              }}
                            >
                              <span className="map-result-name">{String(feature.properties.Nombre ?? "Sin nombre")}</span>
                              <span className="map-result-code">Código: {String(code)}</span>
                              <span className="map-result-state">
                                <i style={{ backgroundColor: fixedStateColor(feature.properties.Estado, palette) }} aria-hidden="true" />
                                {state?.label ?? "Estado desconocido"}
                              </span>
                              {!feature.geometry && <span className="map-result-code">Sin ubicación disponible</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="map-muted">Los resultados aparecerán cuando apliques un filtro.</p>
                )}
              </section>
            </div>
            <div id="map-panel-layers" role="tabpanel" aria-labelledby="map-tab-layers" hidden={sidebarTab !== "layers"}>
              <section className="map-sidebar-section border-b border-[#e2e8f0]" aria-labelledby="map-basemap-heading">
                <h2 id="map-basemap-heading">Mapa base</h2>
                <label className="map-basemap-label" htmlFor="map-basemap">
                  Estilo de fondo
                </label>
                <select id="map-basemap" className="map-basemap-select" value={basemapId} onChange={(event) => setBasemapId(event.target.value as BasemapId)}>
                  {Object.entries(basemaps).map(([id, basemap]) => (
                    <option key={id} value={id}>
                      {basemap.label}
                    </option>
                  ))}
                </select>
              </section>
              <section className="map-sidebar-section " aria-labelledby="map-layers-heading">
                <h2 id="map-layers-heading">Capas visibles</h2>
                <p className="map-muted">Activá o desactivá información del mapa.</p>
                {loading ? (
                  <p role="status">Cargando capas…</p>
                ) : (
                  orderedLayers.map((layer) => (
                    <div key={layer.id}>
                      <div className="map-layer-row">
                        <label>
                          <input type="checkbox" checked={visible.has(layer.id)} onChange={(event) => setLayerVisible(layer.id, event.target.checked)} />
                          <span>{layer.label}</span>
                        </label>
                      </div>
                      {layer.id === "CodigosFijos" && !visible.has(layer.id) && <p className="map-muted map-layer-help">Activá esta capa para buscar códigos fijos y ver sus resultados.</p>}
                    </div>
                  ))
                )}
              </section>
            </div>
            <div id="map-panel-legend" role="tabpanel" aria-labelledby="map-tab-legend" hidden={sidebarTab !== "legend"}>
              <section className="map-legend map-sidebar-section" aria-labelledby="map-legend-heading">
                <h2 id="map-legend-heading">Leyenda de colores</h2>
                <p className="map-muted">Tocá un color para cambiarlo. Se guarda en este navegador.</p>
                {paletteStorageError && <p role="status">El color se aplicó, pero no se pudo guardar en este navegador.</p>}
                {activeLayers.length === 0 && <p className="map-muted">Activá una capa en la pestaña Capas para ver sus colores.</p>}
                {activeLayers.flatMap((layer) =>
                  layer.id === "CodigosFijos"
                    ? fixedStates
                        .map((state) => (
                          <div key={`state-${state.value}`}>
                            {colorPicker(`state-${state.value}`, state.label)}
                            {state.label}
                          </div>
                        ))
                        .concat(
                          [{ label: "Estado desconocido", color: "#64748b", value: 0 }].map((state) => (
                            <div key="state-unknown">
                              {colorPicker("state-unknown", state.label)}
                              {state.label}
                            </div>
                          )),
                        )
                    : [
                        <div key={layer.id}>
                          {colorPicker(layer.id, layer.label)}
                          {layer.label}
                        </div>,
                      ],
                )}
              </section>
            </div>
          </aside>
        </div>
      </main>
    </AuthenticatedLayout>
    </PaletteContext.Provider>
  );
}
