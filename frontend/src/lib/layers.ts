import { apiFetch } from "./auth";

export type LayerId = "CodigosFijos" | "Lotes" | "Manzanas" | "Vias";
export interface Feature { type: "Feature"; id: number; geometry: GeoJSON.Geometry | null; properties: Record<string, unknown> }
export interface FeatureCollection { type: "FeatureCollection"; features: Feature[]; numberReturned: number; limit: number; srid: 4326 }
export interface Layer { id: LayerId; label: string; geometryType: string; srid: number }
export interface Extent { west: number; south: number; east: number; north: number; srid: number }
export interface SearchResult { id: number; type: "Feature"; geometry: GeoJSON.Geometry | null; properties: Record<string, unknown>; layer?: LayerId }
export interface SearchResponse { data: { items: SearchResult[]; page: number; pageSize: number; total: number }; meta: Record<string, unknown> }
export const layerFields: Record<LayerId, string[]> = {
  CodigosFijos: ["CodF_SQL", "CodF_SIG", "CodFijo", "Nombre", "Estado", "IdLote", "Longitud", "Latitud"],
  Lotes: ["IdOrigen", "NroLote", "IdManzana"], Manzanas: ["IdOrigen", "UV", "MZA"], Vias: ["OBJECTID", "Nombre", "TipoVia", "OSMID"]
};
export async function searchLayer(layer: LayerId, q: string, filters: Record<string, string>, page: number, pageSize = 25): Promise<SearchResponse> {
  const params = new URLSearchParams({ layer, page: String(page), pageSize: String(pageSize), sortBy: layer === "CodigosFijos" ? "IdCodigo" : layer === "Lotes" ? "IdLote" : layer === "Manzanas" ? "IdManzana" : "IdVia", sortDirection: "asc" });
  if (q.trim()) params.set("q", q.trim());
  Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
  return request<SearchResponse>(`/api/search?${params}`);
}

async function request<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) {
    let message = "No se pudieron cargar los datos del mapa.";
    try { const problem = await response.json(); message = problem.detail || problem.title || message; } catch { /* ProblemDetails body is optional. */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
export const getLayers = async () => (await request<{ layers: Layer[] }>("/api/layers")).layers;
export const getViaTypes = async () => (await request<{ data: { values: string[] } }>("/api/search/options/via-types")).data.values;

export async function searchAllLayers(q: string, page: number): Promise<SearchResponse> {
  const layerIds: LayerId[] = ["CodigosFijos", "Lotes", "Manzanas", "Vias"];
  const counts = await Promise.all(layerIds.map(async layer => ({ layer, total: (await searchLayer(layer, q, {}, 1, 1)).data.total })));
  const start = (page - 1) * 25;
  const end = start + 25;
  let cursor = 0;
  const items: SearchResult[] = [];
  for (const { layer, total } of counts) {
    const layerStart = cursor;
    const layerEnd = cursor + total;
    cursor = layerEnd;
    const from = Math.max(start, layerStart);
    const to = Math.min(end, layerEnd);
    if (from >= to) continue;
    let offset = from - layerStart;
    const take = to - from;
    while (items.filter(item => item.layer === layer).length < take) {
      const localPage = Math.floor(offset / 25) + 1;
      const skip = offset % 25;
      const result = await searchLayer(layer, q, {}, localPage, 25);
      const batch = result.data.items.slice(skip, skip + Math.min(25 - skip, take - items.filter(item => item.layer === layer).length));
      items.push(...batch.map(item => ({ ...item, layer })));
      offset += batch.length;
      if (batch.length === 0) break;
    }
  }
  return { data: { items, page, pageSize: 25, total: cursor }, meta: {} };
}
export const getLayerFeatures = (layer: LayerId) => request<FeatureCollection>(`/api/layers/${layer}/geojson?limit=1000`);
export const getLayerExtent = (layer: LayerId) => request<Extent>(`/api/layers/${layer}/extent`);
