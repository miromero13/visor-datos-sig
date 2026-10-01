import { apiFetch } from "./auth";

export type LayerId = "CodigosFijos" | "Lotes" | "Manzanas" | "Vias";
export interface Feature { type: "Feature"; id: number; geometry: GeoJSON.Geometry | null; properties: Record<string, unknown> }
export interface FeatureCollection { type: "FeatureCollection"; features: Feature[]; numberReturned: number; limit: number; srid: 4326 }
export interface Layer { id: LayerId; label: string; geometryType: string; srid: number }
export interface Extent { west: number; south: number; east: number; north: number; srid: number }

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
export const getLayerFeatures = (layer: LayerId) => request<FeatureCollection>(`/api/layers/${layer}/geojson?limit=1000`);
export const getLayerExtent = (layer: LayerId) => request<Extent>(`/api/layers/${layer}/extent`);
