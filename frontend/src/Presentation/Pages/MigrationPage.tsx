import { useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { CheckCircle2, ChevronDown, FileCheck2, FolderOpen, Play, X } from "lucide-react";
import { useAuth } from "@/Presentation/Components/AuthProvider";
import { AuthenticatedLayout } from "@/Presentation/Layouts/AuthenticatedLayout";
import { InfoTooltip } from "@/Presentation/Components/ui/info-tooltip";
import { Button } from "@/Presentation/Components/ui/button";
import { executeMigration, simulateFixedCodeStates, validateMigration, type FixedCodeSimulationResult, type MigrationExecution, type MigrationMode, type MigrationValidation } from "@/Application/Services/migrations";

const approvedLayers = ["Exp_CodigoFijo_4326", "Exp_MapaBase_LOTES_4326", "Exp_MapaBase_MZA_4326", "Exp_MapaBase_VIAS_4326"] as const;
const components = [".shp", ".shx", ".dbf", ".prj"] as const;

export function MigrationPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [validation, setValidation] = useState<MigrationValidation | null>(null);
  const [result, setResult] = useState<MigrationExecution | null>(null);
  const [simulationResult, setSimulationResult] = useState<FixedCodeSimulationResult | null>(null);
  const [mode, setMode] = useState<MigrationMode>("replace");
  const [busy, setBusy] = useState<"validate" | "execute" | "simulate" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const simulationDialog = useRef<HTMLDialogElement>(null);
  const simulationInFlight = useRef(false);

  function selectFiles(selected: File[]) {
    if (busy !== null) return;
    controller.current?.abort();
    setFiles(selected);
    setValidation(null);
    setResult(null);
    setError("");
    setNotice("");
  }

  async function validate() {
    if (busy !== null) return;
    if (!files.length) {
      setError("Seleccioná los archivos de las capas que querés migrar.");
      return;
    }
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy("validate");
    setError("");
    setNotice("");
    setValidation(null);
    setResult(null);
    try {
      const value = await validateMigration(files, abort.signal);
      setValidation(value);
      if (!value.valid) setError(value.errors.join(" ") || "La validación encontró problemas.");
    } catch (cause) {
      if (abort.signal.aborted) setNotice("Validación cancelada.");
      else setError(cause instanceof Error ? cause.message : "No se pudieron validar los archivos.");
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(null);
      }
    }
  }

  async function execute() {
    if (busy !== null || !validation?.valid) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy("execute");
    setError("");
    setNotice("");
    setResult(null);
    try {
      setResult(await executeMigration(files, mode, abort.signal));
    } catch (cause) {
      if (abort.signal.aborted) setNotice("Ejecución cancelada. Revisá el estado de los datos antes de volver a ejecutar.");
      else setError(cause instanceof Error ? cause.message : "No se pudo completar la migración.");
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(null);
      }
    }
  }

  function openSimulationDialog() {
    if (busy !== null || simulationInFlight.current) return;
    simulationDialog.current?.showModal();
  }

  async function simulateStates() {
    if (busy !== null || simulationInFlight.current) return;
    simulationInFlight.current = true;
    simulationDialog.current?.close();
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy("simulate");
    setError("");
    setNotice("");
    setSimulationResult(null);
    try {
      setSimulationResult(await simulateFixedCodeStates(abort.signal));
    } catch (cause) {
      if (abort.signal.aborted) setNotice("La solicitud se interrumpió. El resultado es incierto; verificá los datos antes de volver a ejecutar.");
      else setError(cause instanceof Error ? cause.message : "No se pudo confirmar el resultado. Verificá los datos antes de volver a ejecutar.");
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(null);
      }
      simulationInFlight.current = false;
    }
  }

  function cancel() {
    controller.current?.abort();
  }

  if (!user?.roles.includes("Administrador")) return <Navigate to="/dashboard" replace />;

  return (
    <AuthenticatedLayout activeItem="Migración">
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Migración de capas</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Seleccioná los componentes Shapefile de las capas aprobadas, validá el contenido y luego ejecutá la migración. Los archivos se envían a la API solo al validar o ejecutar; no se guardan en el navegador.</p>

          <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-7" aria-labelledby="files-heading">
            <div className="flex items-center gap-2">
              <h2 id="files-heading" className="text-lg font-semibold text-slate-900 m-0">
                1. Archivos de origen
              </h2>
              <InfoTooltip text="Seleccioná los 4 archivos obligatorios (.shp, .shx, .dbf, .prj) correspondientes a cada capa que desees importar." />
            </div>
            <p className="mt-2 text-sm text-slate-600">Por cada capa incluí los cuatro componentes requeridos: {components.join(", ")}.</p>
            <ul className="mt-3 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
              {approvedLayers.map((layer) => (
                <li key={layer} className="font-mono">
                  {layer}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-slate-800 bg-slate-800 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:border-slate-900 hover:bg-slate-900 focus-within:ring-2 focus-within:ring-slate-500 focus-within:ring-offset-2">
                <FolderOpen size={17} aria-hidden="true" />
                Seleccionar componentes
                <input className="sr-only" type="file" multiple accept=".shp,.shx,.dbf,.prj" aria-label="Seleccionar componentes de capas aprobadas" disabled={busy !== null} onChange={(event) => selectFiles(Array.from(event.currentTarget.files ?? []))} />
              </label>
              {files.length > 0 && (
                <Button type="button" variant="outline" className="border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50" onClick={() => selectFiles([])} disabled={busy !== null}>
                  Limpiar
                </Button>
              )}
            </div>
            {files.length > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-sm text-slate-600">{files.length} archivo(s) seleccionado(s)</span>
              </div>
            )}
            {files.length > 0 && (
              <ul className="mt-3 max-h-40 overflow-auto text-xs text-slate-500">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`}>{file.name}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-5 sm:p-7" aria-labelledby="simulation-heading">
            <div className="flex items-center gap-2">
              <h2 id="simulation-heading" className="text-lg font-semibold text-slate-900 m-0">Simulación de estados (solo demostración)</h2>
              <InfoTooltip text="Asigna aleatoriamente estados del 1 al 5 a los códigos fijos para pruebas de demostración. Sobrescribe la base de datos." />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-700">Genera estados simulados para todos los códigos fijos ya guardados, independientemente de los archivos seleccionados o validados. Sobrescribe irreversiblemente TODOS los estados existentes; no hay deshacer. No modifica archivos SHP.</p>
            <Button type="button" size="lg" className="mt-4 border border-amber-800 bg-amber-700 px-5 font-semibold text-white shadow-sm hover:border-amber-900 hover:bg-amber-800" onClick={openSimulationDialog} disabled={busy !== null}>
              {busy === "simulate" ? "Simulando…" : "Simular 5 estados de código fijo"}
            </Button>
            <dialog ref={simulationDialog} aria-labelledby="simulation-dialog-title" aria-describedby="simulation-dialog-description" className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60">
              <div className="p-6">
                <h3 id="simulation-dialog-title" className="text-lg font-semibold">Confirmar simulación</h3>
                <p id="simulation-dialog-description" className="mt-3 text-sm leading-6 text-slate-700">Esta acción sobrescribirá los estados de TODOS los códigos fijos existentes. No hay deshacer.</p>
                <div className="mt-6 flex justify-end gap-3">
                  <Button type="button" variant="outline" autoFocus className="border-slate-300 bg-white text-slate-700" onClick={() => simulationDialog.current?.close()}>Cancelar</Button>
                  <Button type="button" className="border border-red-800 bg-red-700 font-semibold text-white hover:border-red-900 hover:bg-red-800" disabled={busy !== null} onClick={() => void simulateStates()}>Confirmar simulación</Button>
                </div>
              </div>
            </dialog>
            {busy === "simulate" && <p role="status" className="mt-3 text-sm text-slate-700">Actualizando de forma transaccional todos los estados guardados…</p>}
            {busy === "simulate" && <Button type="button" variant="outline" className="ml-3 border-slate-300 bg-white text-slate-700" onClick={cancel}>Cancelar solicitud</Button>}
            {simulationResult && (simulationResult.total === 0
              ? <p role="status" className="mt-4 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-800">No hay códigos fijos guardados; no se actualizaron registros.</p>
              : <div role="status" className="mt-4 rounded-lg border border-amber-300 bg-white p-4 text-sm text-slate-900" aria-live="polite">
                  <h3 className="font-semibold">Simulación persistida: {simulationResult.total.toLocaleString("es-AR")} códigos fijos</h3>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {[{ state: 1, label: "Normal", color: "text-green-700" }, { state: 3, label: "Cortado", color: "text-amber-700" }, { state: 2, label: "Para corte", color: "text-orange-700" }, { state: 4, label: "Baja parcial", color: "text-red-600" }, { state: 5, label: "Baja total", color: "text-red-900" }].map(({ state, label, color }) => <li key={state} className={color}>{label}: {(simulationResult.counts[String(state)] ?? 0).toLocaleString("es-AR")}</li>)}
                  </ul>
                </div>)}
          </section>

          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-7" aria-labelledby="validation-heading">
            <div className="flex items-center gap-2">
              <h2 id="validation-heading" className="text-lg font-semibold text-slate-900 m-0">
                2. Validar y revisar
              </h2>
              <InfoTooltip text="Comprueba la integridad de los archivos, atributos y proyección geográfica (CRS) antes de impactar en la base de datos." />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Se verifica el sistema de referencia de coordenadas (CRS) y, cuando corresponde, el servidor aplica la transformación aprobada. La validación no implica reparación de geometrías.</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button size="lg" className="border border-blue-700 bg-blue-700 px-5 font-semibold text-white shadow-sm hover:border-blue-800 hover:bg-blue-800 focus-visible:ring-blue-500" onClick={() => void validate()} disabled={busy !== null || files.length === 0}>
                <FileCheck2 size={17} aria-hidden="true" />
                {busy === "validate" ? "Validando…" : "Validar archivos"}
              </Button>
              {busy === "validate" && (
                <Button type="button" variant="outline" size="lg" className="border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50" onClick={cancel}>
                  <X size={16} aria-hidden="true" />
                  Cancelar
                </Button>
              )}
            </div>
            {busy === "validate" && (
              <p role="status" className="mt-3 text-sm text-slate-600">
                Validando componentes y registros…
              </p>
            )}
            {validation && (
              <div className="mt-5" aria-live="polite">
                <p className={`flex items-center gap-2 font-medium ${validation.valid ? "text-green-700" : "text-red-700"}`}>
                  {validation.valid && <CheckCircle2 size={17} aria-hidden="true" />}
                  {validation.valid ? "Validación correcta" : "Validación con observaciones"}
                </p>
                {validation.layers.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-slate-500">
                          <th className="py-2 pr-3">Capa</th>
                          <th className="py-2 pr-3">Tabla</th>
                          <th className="py-2">Registros</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validation.layers.map((layer) => (
                          <tr key={layer.layer} className="border-b border-slate-100">
                            <td className="py-2 pr-3 font-mono text-xs">{layer.layer}</td>
                            <td className="py-2 pr-3">{layer.table}</td>
                            <td className="py-2">{layer.records.toLocaleString("es-AR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {validation.errors.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-700">
                    {validation.errors.map((item, index) => (
                      <li key={`${index}-${item}`}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-7" aria-labelledby="execute-heading">
            <div className="flex items-center gap-2">
              <h2 id="execute-heading" className="text-lg font-semibold text-slate-900 m-0">
                3. Ejecutar migración
              </h2>
              <InfoTooltip text="Transfiere de forma transaccional las capas validadas a las tablas oficiales de SQL Server." />
            </div>
            <label className="mt-5 block text-sm font-medium text-slate-700">
              <span className="flex items-center gap-1.5">
                Modo de carga
                <InfoTooltip text="Reemplazar sobrescribe las capas seleccionadas; Agregar suma nuevos registros sin eliminar los anteriores." />
              </span>
              <span className="relative mt-2 block">
                <select className="block h-11 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white px-3 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 [&>option]:cursor-pointer" value={mode} onChange={(event) => setMode(event.target.value as MigrationMode)} disabled={busy !== null}>
                  <option value="replace">Reemplazar datos existentes</option>
                  <option value="append">Agregar a los datos existentes</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} aria-hidden="true" />
              </span>
            </label>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button size="lg" className="border border-emerald-700 bg-emerald-600 px-5 font-semibold text-white shadow-sm hover:border-emerald-800 hover:bg-emerald-700 focus-visible:ring-emerald-500" onClick={() => void execute()} disabled={busy !== null || !validation?.valid}>
                <Play size={16} fill="currentColor" aria-hidden="true" />
                {busy === "execute" ? "Ejecutando…" : "Ejecutar migración"}
                {busy === "execute" && <span className="sr-only">, en progreso</span>}
              </Button>
              {busy === "execute" && (
                <Button type="button" variant="outline" size="lg" className="border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50" onClick={cancel}>
                  <X size={16} aria-hidden="true" />
                  Cancelar
                </Button>
              )}
            </div>
            {busy === "execute" && (
              <p role="status" className="mt-3 text-sm text-slate-600">
                Procesando capas en el servidor. No cierres esta página.
              </p>
            )}
            {result && (
              <div role="status" className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                <h3 className="font-semibold">Migración completada</h3>
                <p className="mt-1">
                  {result.progress.processedRecords.toLocaleString("es-AR")} registros procesados en {result.progress.completedLayers} de {result.progress.totalLayers} capas.
                </p>
                <ul className="mt-2 space-y-1">
                  {result.layers.map((layer) => (
                    <li key={layer.layer}>
                      {layer.layer}: {layer.inserted.toLocaleString("es-AR")} registros en {layer.table}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          {error && (
            <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {notice}
            </p>
          )}
        </div>
      </main>
    </AuthenticatedLayout>
  );
}
