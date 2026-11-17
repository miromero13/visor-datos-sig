import type { ExpressionSpecification, Map as GLMap, GeoJSONSource, StyleSpecification } from "maplibre-gl";
import type { Feature, Layer, LayerId } from "@/Application/Services/layers";

export interface MapCamera { longitude: number; latitude: number; zoom: number }
export interface MapBasemap { url?: string; attribution?: string }
export type MapCollections = Partial<Record<LayerId, GeoJSON.FeatureCollection>>;
export const emptyCollection: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
export const terrainAttribution = 'Terrain: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Mapzen / terrain data providers</a>';
export const terrainCredits = "Terrain: Mapzen; ArcticDEM (NSF 1043681, 1559691, 1542736); Geoscience Australia; offene Daten Österreichs; Canada Open Government Licence; Copernicus EU-DEM; NOAA ETOPO1; INEGI; LINZ © Crown 2011; Kartverket; © Environment Agency 2015; USGS 3DEP/GMTED2010/SRTM.";
const order: LayerId[] = ["Vias", "Manzanas", "Lotes", "CodigosFijos"];
const parts = ["fill", "line", "points"] as const;

export function map3dStyle(basemap: MapBasemap): StyleSpecification {
  return {
    version: 8,
    sources: {
      terrain: { type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], tileSize: 256, encoding: "terrarium", maxzoom: 15, attribution: terrainAttribution },
      ...(basemap.url ? { basemap: { type: "raster" as const, tiles: [basemap.url.replace("{s}", "a").replace("{r}", "")], tileSize: 256, maxzoom: 17, attribution: basemap.attribution } } : {}),
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#e2e8f0" } },
      ...(basemap.url ? [{ id: "basemap", type: "raster" as const, source: "basemap" }] : []),
    ],
    terrain: { source: "terrain", exaggeration: 1 },
  };
}

function colorFor(id: LayerId, palette: Record<string, string>): string | ExpressionSpecification {
  return id === "CodigosFijos"
    ? ["match", ["to-number", ["get", "Estado"], -1], 1, palette["state-1"] ?? "#16a34a", 2, palette["state-2"] ?? "#f97316", 3, palette["state-3"] ?? "#dc2626", 4, palette["state-4"] ?? "#8b5cf6", 5, palette["state-5"] ?? "#6b7280", palette["state-unknown"] ?? "#64748b"]
    : palette[id] ?? "#0ea5e9";
}
function updateSource(map: GLMap, id: string, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource(id, { type: "geojson", data });
}
function addGeometryLayers(map: GLMap, id: string, color: string | ExpressionSpecification, selected = false) {
  if (!map.getLayer(`${id}-fill`)) {
    map.addLayer({ id: `${id}-fill`, type: "fill", source: id, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": color, "fill-opacity": selected ? 0.4 : 0.22 } });
    map.addLayer({ id: `${id}-line`, type: "line", source: id, filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": color, "line-width": selected ? 3 : id === "Vias" ? 2 : 1 } });
    map.addLayer({ id: `${id}-points`, type: "circle", source: id, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": color, "circle-radius": selected ? 8 : 4, "circle-opacity": selected ? 0.5 : 0.9, "circle-stroke-color": color, "circle-stroke-width": selected ? 3 : 1 } });
  }
  map.setPaintProperty(`${id}-fill`, "fill-color", color);
  map.setPaintProperty(`${id}-line`, "line-color", color);
  map.setPaintProperty(`${id}-points`, "circle-color", color);
  map.setPaintProperty(`${id}-points`, "circle-stroke-color", color);
}
export function syncMap3dLayers(map: GLMap, layers: Layer[], data: MapCollections, palette: Record<string, string>, selected: { layer: Layer; feature: Feature } | null) {
  for (const id of order) {
    updateSource(map, id, data[id] ?? emptyCollection);
    addGeometryLayers(map, id, colorFor(id, palette));
    for (const part of parts) map.setLayoutProperty(`${id}-${part}`, "visibility", layers.some((layer) => layer.id === id) ? "visible" : "none");
  }
  updateSource(map, "selection", selected?.feature.geometry ? { type: "FeatureCollection", features: [{ ...selected.feature, geometry: selected.feature.geometry }] } : emptyCollection);
  addGeometryLayers(map, "selection", selected ? colorFor(selected.layer.id, palette) : "#16a34a", true);
}

export function geometryBounds(geometry: GeoJSON.Geometry | null): [[number, number], [number, number]] | null {
  if (!geometry) return null;
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      const [lng, lat] = value;
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) return;
      west = Math.min(west, lng); east = Math.max(east, lng); south = Math.min(south, lat); north = Math.max(north, lat);
    } else value.forEach(visit);
  };
  const walk = (g: GeoJSON.Geometry) => g.type === "GeometryCollection" ? g.geometries.forEach(walk) : visit(g.coordinates);
  walk(geometry);
  return Number.isFinite(west) ? [[west, south], [east, north]] : null;
}
