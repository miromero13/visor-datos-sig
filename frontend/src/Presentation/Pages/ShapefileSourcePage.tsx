import { useState } from "react";
import { Link } from "react-router-dom";
import type { ShapefileLayer } from "@/Infrastructure/Api/shapefileSources";
import { apiFetch } from "@/Application/Services/auth";
import { Header } from "@/Presentation/Components/Header";
import { Button } from "@/Presentation/Components/ui/button";

export function ShapefileSourcePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [layers, setLayers] = useState<ShapefileLayer[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function analyze() {
    setLoading(true);
    setError("");
    setLayers([]);
    try {
      const body = new FormData();
      for (const file of files) body.append("files", file, file.name);
      const response = await apiFetch("/api/shapefile-sources/analyze", { method: "POST", body, headers: {} });
      if (!response.ok) throw new Error(`La API no pudo analizar los archivos (HTTP ${response.status}).`);
      const result = await response.json() as { layers?: ShapefileLayer[] };
      if (!Array.isArray(result.layers)) throw new Error("La respuesta de la API no tiene el formato esperado.");
      setLayers(result.layers);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron analizar los archivos."); }
    finally { setLoading(false); }
  }
  function selectFiles(selected: File[]) { setFiles(selected); setLayers([]); setError(""); }
  return (
    <>
      <Header />
      <main className="mx-auto w-[min(900px,calc(100%-32px))] py-12 md:py-16">
        <Link className="text-sm font-medium text-[#397db6]" to="/">← Volver al proyecto</Link>
        <p className="mt-8 text-xs font-semibold tracking-widest text-[#43739f] uppercase">Fuentes locales</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#08142e]">Seleccionar archivos Shapefile</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#58698a]">Elegí archivos .shp y sus componentes, o una carpeta. Se enviarán a la API solo al confirmar, para un análisis temporal de nombres; no se guardan.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-[#08142e] px-4 text-sm font-semibold text-white hover:bg-[#142955]">Seleccionar archivos<input className="sr-only" aria-label="Seleccionar archivos Shapefile" type="file" multiple accept=".shp,.shx,.dbf,.prj" onChange={event => selectFiles(Array.from(event.target.files ?? []))} /></label>
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-[#c6d4e9] bg-white px-4 text-sm font-semibold text-[#08142e]">Seleccionar carpeta<input className="sr-only" aria-label="Seleccionar carpeta con archivos Shapefile" type="file" multiple onChange={event => { event.currentTarget.setAttribute("webkitdirectory", ""); selectFiles(Array.from(event.target.files ?? [])); }} ref={input => input?.setAttribute("webkitdirectory", "")} /></label>
          {files.length > 0 && <Button variant="outline" onClick={() => selectFiles([])}>Limpiar selección</Button>}
        </div>
        {files.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-3"><span className="text-sm text-[#58698a]">{files.length} archivo(s) seleccionado(s)</span><Button onClick={analyze} disabled={loading}>{loading ? "Analizando…" : "Enviar archivos para análisis temporal"}</Button></div>}
        {loading && <p role="status" className="mt-5 text-sm text-[#58698a]">Enviando archivos y validando componentes en la API…</p>}
        {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <section className="mt-9" aria-live="polite" aria-label="Capas seleccionadas">
          {layers.length === 0 && !loading && !error ? <p className="rounded-lg border border-[#dce6f5] bg-white p-5 text-sm text-[#58698a]">{files.length ? "Enviá los archivos para ver el resultado del análisis." : "Todavía no hay archivos seleccionados."}</p> : <ul className="space-y-3">{layers.map(layer => <li key={layer.name.toLocaleLowerCase()} className="rounded-lg border border-[#dce6f5] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-[#08142e]">{layer.name}</h2><span className={layer.complete ? "text-sm font-medium text-green-700" : "text-sm font-medium text-amber-800"}>{layer.complete ? "Completa" : "Incompleta"}</span></div><p className="mt-2 text-sm text-[#58698a]">{layer.files.join(", ")}</p>{!layer.complete && <p className="mt-2 text-sm text-amber-800">Faltan componentes: {layer.missingExtensions.join(", ")}</p>}</li>)}</ul>}
        </section>
        <p className="mt-8 text-xs text-[#647591]">El análisis es temporal y se limita a los nombres de archivo; no se leen ni conservan contenidos GIS.</p>
      </main>
    </>
  );
}
