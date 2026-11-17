import { apiFetch } from "./auth";

export interface DeparturePointDto {
  lat: number;
  lon: number;
}

export interface OperatorWorkloadDto {
  idUsuario: number;
  login: string;
  nombre: string;
  rol: string;
  tareasPendientesHoy: number;
  tareasCompletadasHoy: number;
}

export interface SequencedStopDto {
  orden: number;
  idCodigo: number;
  codFijo: number | null;
  nombre: string | null;
  estado: number;
  lat: number;
  lon: number;
  distanciaDesdeAnteriorMeters: number;
  distanciaAcumuladaMeters: number;
}

export interface CalculateRouteResult {
  rutaGeoJson: GeoJSON.FeatureCollection;
  paradas: SequencedStopDto[];
  distanciaTotalMeters: number;
  totalParadas: number;
}

export interface AssignmentSummaryDto {
  idAsignacion: number;
  idUsuario: number;
  operador: string;
  tipoAsignacion: "Corte" | "Reconexion";
  fechaAsignacion: string;
  puntoPartidaLat: number;
  puntoPartidaLon: number;
  cantidadCodigos: number;
  estado: string;
  completados: number;
  observados: number;
  pendientes: number;
}

export interface AssignmentDetailItemDto {
  idAsignacionDetalle: number;
  idAsignacion: number;
  idCodigo: number;
  codFijo: number | null;
  nombre: string | null;
  ordenSecuencia: number;
  estado: string;
  lecturaMedidor: string | null;
  observacion: string | null;
  fotoEvidenciaUrl: string | null;
  latitudEjecucion: number | null;
  longitudEjecucion: number | null;
  fechaHoraEjecucion: string | null;
  distanciaDesvioMetros: number | null;
  latitudMedidor: number;
  longitudMedidor: number;
}

export interface TrackingHistoryPointDto {
  idTracking: number;
  idUsuario: number;
  operador: string;
  idAsignacion: number | null;
  latitud: number;
  longitud: number;
  velocidadKmh: number | null;
  fechaHora: string;
  evento: string | null;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    let message = "Error al comunicarse con el servidor de operaciones.";
    try {
      const problem = await response.json();
      message = problem.detail || problem.title || message;
    } catch {
      // Optional problem payload
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function getOperators(signal?: AbortSignal): Promise<OperatorWorkloadDto[]> {
  return requestJson<OperatorWorkloadDto[]>("/api/asignaciones/operadores", { signal });
}

export function calculateOptimalRoute(
  payload: {
    tipo: "Corte" | "Reconexion";
    cantidad: number;
    puntoPartida: DeparturePointDto;
  },
  signal?: AbortSignal,
): Promise<CalculateRouteResult> {
  return requestJson<CalculateRouteResult>("/api/asignaciones/calcular-ruta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}

export function saveAssignment(
  payload: {
    idUsuario: number;
    tipo: "Corte" | "Reconexion";
    puntoPartida: DeparturePointDto;
    idsCodigosFijos: number[];
  },
  signal?: AbortSignal,
): Promise<{ idAsignacion: number; message: string }> {
  return requestJson<{ idAsignacion: number; message: string }>("/api/asignaciones/guardar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}

export function getAssignments(tipo?: string, signal?: AbortSignal): Promise<AssignmentSummaryDto[]> {
  const params = new URLSearchParams();
  if (tipo) params.set("tipo", tipo);
  const query = params.toString() ? `?${params.toString()}` : "";
  return requestJson<AssignmentSummaryDto[]>(`/api/asignaciones${query}`, { signal });
}

export function getAssignmentDetails(idAsignacion: number, signal?: AbortSignal): Promise<AssignmentDetailItemDto[]> {
  return requestJson<AssignmentDetailItemDto[]>(`/api/asignaciones/${idAsignacion}/detalles`, { signal });
}

export function getTrackingHistory(
  filters: { idUsuario?: number; idAsignacion?: number; fecha?: string },
  signal?: AbortSignal,
): Promise<TrackingHistoryPointDto[]> {
  const params = new URLSearchParams();
  if (filters.idUsuario !== undefined) params.set("idUsuario", String(filters.idUsuario));
  if (filters.idAsignacion !== undefined) params.set("idAsignacion", String(filters.idAsignacion));
  if (filters.fecha) params.set("fecha", filters.fecha);
  const query = params.toString() ? `?${params.toString()}` : "";
  return requestJson<TrackingHistoryPointDto[]>(`/api/monitoreo/recorridos${query}`, { signal });
}

function isValidLatLon(lat: number, lon: number): boolean {
  return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * Parsea enlaces de mapas (Google Maps, Apple Maps, OpenStreetMap) o coordenadas en texto
 * para extraer la latitud y longitud del punto de partida.
 */
export function parseMapLinkOrCoordinates(input: string): DeparturePointDto | null {
  if (!input || typeof input !== "string") return null;
  const raw = decodeURIComponent(input.trim());

  // 1. Google Maps @lat,lon (ej: /@ -16.3905,-60.9712,17z)
  const atMatch = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lon = parseFloat(atMatch[2]);
    if (isValidLatLon(lat, lon)) return { lat, lon };
  }

  // 2. Query param style: q=lat,lon, query=lat,lon, ll=lat,lon, daddr=lat,lon, loc:lat,lon, /dir//lat,lon
  const qMatch = raw.match(
    /(?:[?&](?:q|query|ll|daddr|saddr|center)=|loc:|\/dir\/\/)(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/i,
  );
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lon = parseFloat(qMatch[2]);
    if (isValidLatLon(lat, lon)) return { lat, lon };
  }

  // 3. OpenStreetMap query style: mlat=lat&mlon=lon
  const mlatMatch = raw.match(/[?&]mlat=(-?\d+\.\d+)/i);
  const mlonMatch = raw.match(/[?&]mlon=(-?\d+\.\d+)/i);
  if (mlatMatch && mlonMatch) {
    const lat = parseFloat(mlatMatch[1]);
    const lon = parseFloat(mlonMatch[1]);
    if (isValidLatLon(lat, lon)) return { lat, lon };
  }

  // 4. OpenStreetMap hash style: #map=zoom/lat/lon
  const osmHashMatch = raw.match(/#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/);
  if (osmHashMatch) {
    const lat = parseFloat(osmHashMatch[1]);
    const lon = parseFloat(osmHashMatch[2]);
    if (isValidLatLon(lat, lon)) return { lat, lon };
  }

  // 5. Plain decimal coordinates: "-16.3905, -60.9712" o "lat: -16.3905, lon: -60.9712"
  const plainMatch = raw.match(/(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/);
  if (plainMatch) {
    const lat = parseFloat(plainMatch[1]);
    const lon = parseFloat(plainMatch[2]);
    if (isValidLatLon(lat, lon)) return { lat, lon };
  }

  // 6. Degrees Minutes Seconds (DMS): 16°23'25.8"S 60°58'16.4"W
  const dmsRegex = /(\d+)[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)["]?\s*([NSEWnsew])/g;
  const dmsMatches = [...raw.matchAll(dmsRegex)];
  if (dmsMatches.length >= 2) {
    const parseDMS = (m: RegExpMatchArray) => {
      const deg = parseFloat(m[1]);
      const min = parseFloat(m[2]);
      const sec = parseFloat(m[3]);
      const dir = m[4].toUpperCase();
      let dec = deg + min / 60 + sec / 3600;
      if (dir === "S" || dir === "W") dec = -dec;
      return dec;
    };
    const c1 = parseDMS(dmsMatches[0]);
    const c2 = parseDMS(dmsMatches[1]);
    const lat =
      dmsMatches[0][4].toUpperCase() === "S" || dmsMatches[0][4].toUpperCase() === "N" ? c1 : c2;
    const lon =
      dmsMatches[0][4].toUpperCase() === "W" || dmsMatches[0][4].toUpperCase() === "E" ? c1 : c2;
    if (isValidLatLon(lat, lon)) return { lat, lon };
  }

  return null;
}
