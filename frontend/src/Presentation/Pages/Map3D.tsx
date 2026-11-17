import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { Map as GLMap, MapMouseEvent, ErrorEvent } from "maplibre-gl";
import type { Extent, Feature, Layer, SearchResult } from "@/Application/Services/layers";
import { geometryBounds, map3dStyle, syncMap3dLayers, terrainCredits, type MapBasemap, type MapCamera, type MapCollections } from "./map3dStyle";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";

export interface Map3DHandle {
  capture: () => Promise<HTMLCanvasElement>;
  zoomIn: () => void;
  zoomOut: () => void;
  center: () => void;
}
export interface Map3DProps {
  ref?: Ref<Map3DHandle>;
  camera: MapCamera | null;
  bearing: number;
  pitch?: number;
  basemap: MapBasemap;
  layers: Layer[];
  data: MapCollections;
  palette: Record<string, string>;
  selected: { layer: Layer; feature: Feature } | null;
  target: SearchResult | null;
  extent: Extent | null;
  onSelect: (feature: Feature, layer: Layer) => void;
  onClear: () => void;
  onCameraChange: (camera: MapCamera) => void;
  onBearingChange: (bearing: number) => void;
  onPitchChange?: (pitch: number) => void;
  onFallback: () => void;
}

export function Map3D(props: Map3DProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  const styleReady = useRef(false);
  const [error, setError] = useState("");
  const [terrainFailed, setTerrainFailed] = useState(false);
  const terrainUnavailable = useRef(false);
  const initialFit = useRef(false);
  const handledTarget = useRef(props.camera ? props.target : null);
  const basemapKey = useRef("");
  const pendingCaptures = useRef(new Set<() => void>());

  const fitOverview = () => {
    const map = mapRef.current;
    const { extent, target } = latest.current;
    if (!map || !loaded.current) return;
    const bounds = geometryBounds(target?.geometry ?? null) ?? (extent ? [[extent.west, extent.south], [extent.east, extent.north]] as [[number, number], [number, number]] : null);
    if (bounds) map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 });
  };
  useImperativeHandle(props.ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    center: fitOverview,
    capture: async () => {
      const map = mapRef.current;
      if (!map || !loaded.current) throw new Error("El mapa 3D debe terminar de cargar antes de capturar.");
      return new Promise<HTMLCanvasElement>((resolve, reject) => {
        const finish = () => { clearTimeout(timer); map.off("render", captureFrame); pendingCaptures.current.delete(cancel); };
        const cancel = () => { finish(); reject(new Error("Se canceló la captura al cerrar el mapa 3D.")); };
        const captureFrame = () => {
          if (map.isMoving() || !map.areTilesLoaded()) return;
          try {
            const source = map.getCanvas();
            if (!source.width || !source.height) throw new Error("El mapa 3D no tiene un tamaño válido.");
            const canvas = document.createElement("canvas");
            const attribution = document.createElement("div");
            attribution.innerHTML = latest.current.basemap.attribution ?? "";
            const credits = `${attribution.textContent ?? ""} · ${terrainCredits}${terrainUnavailable.current ? " (relieve no disponible)" : ""}`;
            const ratio = source.width / Math.max(1, container.current?.clientWidth ?? source.width);
            const font = Math.max(10, Math.round(11 * ratio));
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("No se pudo crear la imagen del mapa 3D.");
            canvas.width = source.width;
            ctx.font = `${font}px sans-serif`;
            const lines: string[] = []; let line = "";
            for (const word of credits.split(/\s+/)) {
              if (line && ctx.measureText(`${line} ${word}`).width > canvas.width - 16) { lines.push(line); line = word; }
              else line = line ? `${line} ${word}` : word;
            }
            if (line) lines.push(line);
            canvas.height = source.height + (lines.length + 1) * (font + 4);
            ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(source, 0, 0);
            ctx.font = `${font}px sans-serif`; ctx.fillStyle = "#334155";
            lines.forEach((text, index) => ctx.fillText(text, 8, source.height + (index + 1) * (font + 4)));
            finish(); resolve(canvas);
          } catch (cause) { finish(); reject(cause); }
        };
        const timer = window.setTimeout(() => { finish(); reject(new Error("El mapa 3D no terminó de cargar las teselas para la captura.")); }, 10000);
        pendingCaptures.current.add(cancel);
        map.on("render", captureFrame);
        map.triggerRepaint();
      });
    },
  }));

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let localMap: GLMap | undefined;
    const publishCamera = () => {
      if (disposed || !localMap) return;
      const center = localMap.getCenter();
      latest.current.onCameraChange({ longitude: center.lng, latitude: center.lat, zoom: localMap.getZoom() + 1 });
      latest.current.onBearingChange(localMap.getBearing());
      latest.current.onPitchChange?.(localMap.getPitch());
    };
    void import("maplibre-gl").then(({ Map, setWorkerUrl }) => {
      if (disposed || !container.current) return;
      // Vite prebundles the main module; explicitly bundle its ESM worker too.
      setWorkerUrl(workerUrl);
      const p = latest.current;
      // Leaflet uses 256px tiles; MapLibre's camera uses a 512px world at zoom 0.
      localMap = new Map({
        container: container.current,
        center: p.camera ? [p.camera.longitude, p.camera.latitude] : [-60.97, -16.39],
        zoom: (p.camera?.zoom ?? 14) - 1,
        pitch: p.pitch ?? 60,
        bearing: p.bearing,
        minPitch: 35,
        maxPitch: 65,
        minZoom: 0,
        maxZoom: 16,
        canvasContextAttributes: { preserveDrawingBuffer: true },
        style: map3dStyle(p.basemap),
        attributionControl: { compact: false },
      });
      mapRef.current = localMap;
      basemapKey.current = JSON.stringify(p.basemap);
      const sync = () => {
        if (disposed || !localMap) return;
        styleReady.current = true;
        const current = latest.current;
        syncMap3dLayers(localMap, current.layers, current.data, current.palette, current.selected);
        if (terrainUnavailable.current) localMap.setTerrain(null);
      };
      localMap.on("load", () => {
        if (disposed) return;
        loaded.current = true; sync(); setReady(true);
      });
      localMap.on("style.load", sync);
      localMap.on("moveend", publishCamera);
      localMap.on("pitch", () => {
        if (!localMap || disposed) return;
        latest.current.onPitchChange?.(localMap.getPitch());
      });
      localMap.on("click", (event: MapMouseEvent) => {
        if (!localMap || !loaded.current) return;
        const current = latest.current;
        const ids = current.layers.flatMap((layer) => ["fill", "line", "points"].map((part) => `${layer.id}-${part}`)).filter((id) => localMap!.getLayer(id));
        const hit = ids.length ? localMap.queryRenderedFeatures(event.point, { layers: ids })[0] : undefined;
        const layer = current.layers.find((item) => item.id === hit?.source);
        const feature = layer && current.data[layer.id]?.features.find((item) => item.id === hit?.id);
        if (feature && layer) current.onSelect(feature as Feature, layer);
        else current.onClear();
      });
      localMap.on("error", (event: ErrorEvent & { sourceId?: string }) => {
        if (disposed) return;
        console.warn("MapLibre resource error", event.sourceId, event.error);
        if (event.sourceId === "terrain") {
          terrainUnavailable.current = true; setTerrainFailed(true); localMap?.setTerrain(null);
        } else setError("No se pudo cargar parte del mapa 3D. Revisá la conexión o volvé a la vista 2D.");
      });
      localMap.getCanvas().addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        if (!disposed) { loaded.current = false; setError("Se perdió el contexto WebGL. Volvé a la vista 2D."); }
      });
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => localMap?.resize());
        observer.observe(container.current);
      }
    }).catch(() => { if (!disposed) setError("No se pudo iniciar la vista 3D. Tu navegador necesita WebGL; podés seguir en 2D."); });
    return () => {
      publishCamera(); disposed = true; loaded.current = false;
      for (const cancel of [...pendingCaptures.current]) cancel();
      observer?.disconnect(); localMap?.remove(); mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    // Camera notifications are observations, not new rotation commands.
    const delta = ((map.getBearing() - props.bearing + 540) % 360) - 180;
    if (Math.abs(delta) > 1e-7) map.setBearing(props.bearing);
  }, [props.bearing, ready]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || props.pitch == null) return;
    if (Math.abs(map.getPitch() - props.pitch) > 0.5) {
      map.setPitch(props.pitch);
    }
  }, [props.pitch, ready]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const key = JSON.stringify(props.basemap);
    if (basemapKey.current !== key) { styleReady.current = false; basemapKey.current = key; map.setStyle(map3dStyle(props.basemap)); }
    else if (styleReady.current) syncMap3dLayers(map, props.layers, props.data, props.palette, props.selected);
  }, [ready, props.basemap, props.layers, props.data, props.palette, props.selected]);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const bounds = geometryBounds(props.target?.geometry ?? null);
    if (bounds && handledTarget.current !== props.target) {
      handledTarget.current = props.target;
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 });
    }
    else if (!props.camera && props.extent && !initialFit.current) { initialFit.current = true; fitOverview(); }
  }, [ready, props.target, props.extent]);

  return <>
    <div ref={container} aria-label="Mapa 3D interactivo" className="h-full w-full" />
    {!ready && !error && <p role="status" className="absolute bottom-10 left-3 z-10 rounded bg-white p-2 text-xs">Cargando mapa 3D…</p>}
    {(error || terrainFailed) && <div role="alert" className="absolute bottom-10 left-3 right-3 z-10 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
      {error || "No se pudo cargar el relieve. La cámara 3D sigue disponible sobre una superficie plana."}
      <button type="button" onClick={props.onFallback} className="ml-2 cursor-pointer underline">Volver a vista 2D</button>
    </div>}
  </>;
}
