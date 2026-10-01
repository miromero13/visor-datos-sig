import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { AuthenticatedLayout } from "@/layouts/AuthenticatedLayout";
import { getLayerExtent, getLayerFeatures, getLayers, type Extent, type Feature, type FeatureCollection, type Layer, type LayerId } from "@/lib/layers";
import "leaflet/dist/leaflet.css";

const colors: Record<LayerId, string> = { CodigosFijos: "#e11d48", Lotes: "#0ea5e9", Manzanas: "#7c3aed", Vias: "#f59e0b" };
function FitExtent({ extent }: { extent: Extent | null }) {
  const map = useMap();
  useEffect(() => { if (extent) map.fitBounds([[extent.south, extent.west], [extent.north, extent.east]], { padding: [28, 28], maxZoom: 17 }); }, [extent, map]);
  return null;
}

function zoomScale(zoom: number) {
  return Math.max(0.55, Math.min(1.6, 0.55 + (zoom - 8) * 0.105));
}

function ZoomStyledGeoJSON({ layer, data, onSelect }: { layer: Layer; data: GeoJSON.FeatureCollection; onSelect: (feature: Feature) => void }) {
  const map = useMap();
  const geoJson = useRef<L.GeoJSON | null>(null);
  useEffect(() => {
    const updateStyle = () => {
      const scale = zoomScale(map.getZoom());
      geoJson.current?.eachLayer(child => {
        if (child instanceof L.Path) child.setStyle({ weight: (layer.id === "Vias" ? 3 : 1.5) * scale });
        if (child instanceof L.CircleMarker) child.setRadius(5 * scale);
      });
    };
    map.on("zoom", updateStyle);
    updateStyle();
    return () => { map.off("zoom", updateStyle); };
  }, [geoJson, layer.id, map]);

  return <GeoJSON ref={geoJson} data={data} style={() => {
    const scale = zoomScale(map.getZoom());
    return { color: colors[layer.id], weight: (layer.id === "Vias" ? 3 : 1.5) * scale, fillColor: colors[layer.id], fillOpacity: layer.id === "CodigosFijos" ? .85 : .22 };
  }} pointToLayer={(_, latlng) => L.circleMarker(latlng, { radius: 5 * zoomScale(map.getZoom()), color: colors[layer.id], fillOpacity: .9 })} onEachFeature={(feature, leafletLayer) => leafletLayer.on("click", () => onSelect(feature as unknown as Feature))} />;
}

export function MapPage() {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [visible, setVisible] = useState<Set<LayerId>>(new Set());
  const [data, setData] = useState<Partial<Record<LayerId, FeatureCollection>>>({});
  const [selected, setSelected] = useState<{ layer: Layer; feature: Feature } | null>(null);
  const [extent, setExtent] = useState<Extent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getLayers().then(async items => {
      if (cancelled) return;
      setLayers(items);
      setVisible(new Set(items.map(x => x.id)));
      if (items.length) {
        try {
          const initialExtent = await getLayerExtent(items[0].id);
          if (!cancelled) setExtent(initialExtent);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "No se pudo obtener la extensión.");
        }
      }
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "No se pudieron cargar las capas."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const missing = [...visible].filter(id => !data[id]);
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(missing.map(async id => [id, await getLayerFeatures(id)] as const)).then(items => {
      if (!cancelled) setData(previous => ({ ...previous, ...Object.fromEntries(items) }));
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [visible, data]);

  const setLayerVisible = useCallback((id: LayerId, checked: boolean) => {
    setVisible(previous => { const next = new Set(previous); checked ? next.add(id) : next.delete(id); return next; });
  }, []);
  const fitLayer = async (id: LayerId) => {
    setError("");
    try { setExtent(await getLayerExtent(id)); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo obtener la extensión."); }
  };
  const activeLayers = useMemo(() => layers.filter(layer => visible.has(layer.id)), [layers, visible]);

  return <AuthenticatedLayout activeItem="Visor de mapa">
    <main className="map-page">
      <div className="map-heading"><div><p className="map-eyebrow">INFORMACIÓN TERRITORIAL</p><h1>Visor de mapa</h1><p>Explorá las capas geográficas disponibles.</p></div><span className="map-coordinate-note">Sistema de coordenadas · WGS 84</span></div>
      {error && <div className="map-alert" role="alert">{error}</div>}
      <div className="map-workspace">
        <aside className="map-sidebar" aria-label="Capas del mapa">
          <h2>Capas</h2><p className="map-muted">Activá o desactivá la información</p>
          {loading ? <p role="status">Cargando capas…</p> : layers.map(layer => <div className="map-layer-row" key={layer.id}>
            <label><input type="checkbox" checked={visible.has(layer.id)} onChange={event => setLayerVisible(layer.id, event.target.checked)} /><span className="map-swatch" style={{ backgroundColor: colors[layer.id] }} /><span>{layer.label}</span></label>
            <button type="button" title={`Acercar a ${layer.label}`} onClick={() => void fitLayer(layer.id)} aria-label={`Acercar a ${layer.label}`}>⌖</button>
          </div>)}
          <div className="map-legend"><h3>Leyenda</h3>{activeLayers.map(layer => <div key={layer.id}><i style={{ background: colors[layer.id] }} />{layer.label}</div>)}</div>
        </aside>
        <section className="map-canvas" aria-label="Mapa interactivo">
          <MapContainer center={[-16.39, -60.97]} zoom={12} scrollWheelZoom className="leaflet-map">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitExtent extent={extent} />
            {activeLayers.map(layer => data[layer.id] && <ZoomStyledGeoJSON key={layer.id} layer={layer} data={data[layer.id] as GeoJSON.FeatureCollection} onSelect={feature => setSelected({ layer, feature })} />)}
          </MapContainer>
          {!loading && activeLayers.length > 0 && activeLayers.every(layer => data[layer.id]?.features.length === 0) && <div className="map-empty">No hay elementos geográficos para mostrar.</div>}
        </section>
        <aside className="map-details" aria-label="Atributos del elemento seleccionado"><h2>Detalle</h2>{selected ? <><p className="map-detail-layer">{selected.layer.label}</p><dl>{Object.entries(selected.feature.properties).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value == null ? "—" : String(value)}</dd></div>)}</dl></> : <p className="map-muted">Seleccioná un elemento del mapa para consultar sus atributos.</p>}</aside>
      </div>
      {error && !loading && <p className="map-retry-note">Revisá tu conexión e intentá nuevamente.</p>}
    </main>
  </AuthenticatedLayout>;
}
