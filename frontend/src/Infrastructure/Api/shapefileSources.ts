export interface ShapefileLayer {
  name: string;
  files: string[];
  missingExtensions: string[];
  complete: boolean;
}

export async function analyzeShapefileSources(files: File[]): Promise<ShapefileLayer[]> {
  const body = new FormData();
  for (const file of files) body.append("files", file, file.name);
  let response: Response;
  try {
    response = await fetch("/api/shapefile-sources/analyze", { method: "POST", body });
  } catch {
    throw new Error("No se pudo conectar con la API. Revisá que el servicio esté disponible e intentá nuevamente.");
  }
  if (response.status === 413) throw new Error("La solicitud excede el límite configurado por el servidor. Seleccioná menos archivos o consultá al administrador.");
  if (!response.ok) throw new Error(`La API no pudo analizar los archivos (HTTP ${response.status}).`);
  const result: { layers?: ShapefileLayer[] } = await response.json();
  if (!Array.isArray(result.layers)) throw new Error("La respuesta de la API no tiene el formato esperado.");
  return result.layers;
}
