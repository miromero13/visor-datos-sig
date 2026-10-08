import { LoaderCircle, RefreshCw } from "lucide-react";
import type { ReportPreview } from "@/Application/Services/reports";
import { hintClass, secondaryButton, sectionTitle } from "./reportStyles";

type Props = { preview: ReportPreview | null; loading: boolean; stale: boolean; onRefresh: () => void };

const numeric = new Set(["integer", "decimal", "coordinate", "currency"]);
const count = (n: number) => n.toLocaleString("es-BO");

/** First rows of the report and the record count per group, before exporting. */
export function ReportPreviewStep({ preview, loading, stale, onRefresh }: Props) {
  return <div className="grid gap-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className={sectionTitle}>Vista previa</h3><p className={hintClass}>Muestra hasta 50 filas con las columnas, filtros y orden elegidos.</p></div>
      <button type="button" className={secondaryButton} onClick={onRefresh} disabled={loading}>
        {loading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}Actualizar vista previa
      </button>
    </div>
    {stale && preview && <p className="m-0 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Cambiaste la configuración: actualizá la vista previa para ver el resultado.</p>}
    {!preview && !loading && <p className="m-0 rounded-md border border-dashed border-slate-300 px-3 py-8 text-center text-sm text-slate-500">Tocá “Actualizar vista previa” para ver cómo quedará el reporte.</p>}
    {preview && <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-slate-800">{count(preview.total)} registros</span>
        {preview.total > preview.rows.length && <span className="text-slate-500">· se muestran los primeros {preview.rows.length}</span>}
      </div>
      {preview.total > preview.maxRows
        ? <p className="m-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">Supera el máximo de {count(preview.maxRows)} registros por reporte. Agregá filtros para reducirlo.</p>
        : preview.total > preview.asyncThreshold && <p className="m-0 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">Es un reporte grande: lo vamos a preparar en segundo plano y te avisamos cuando esté listo para descargar.</p>}
      {preview.groups.length > 0 && <div className="flex flex-wrap gap-1.5" aria-label="Registros por grupo">
        {preview.groups.map(group => <span key={group.label} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{group.label}: <strong>{count(group.count)}</strong></span>)}
      </div>}
      {preview.rows.length === 0
        ? <p className="m-0 rounded-md bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">No hay registros que cumplan los filtros.</p>
        : <div className="max-h-[340px] overflow-auto rounded-md border border-slate-200">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-900 text-white"><tr>{preview.columns.map(c => <th key={c.key} className={`whitespace-nowrap px-2.5 py-2 font-semibold ${numeric.has(c.kind) ? "text-right" : "text-left"}`}>{c.label}</th>)}</tr></thead>
            <tbody>{preview.rows.map((row, r) => <tr key={r} className={r % 2 ? "bg-slate-50" : "bg-white"}>
              {row.map((value, c) => <td key={c} className={`border-b border-slate-100 px-2.5 py-1.5 text-slate-700 ${numeric.has(preview.columns[c].kind) ? "text-right tabular-nums" : ""}`}>{value}</td>)}
            </tr>)}</tbody>
          </table>
        </div>}
    </>}
  </div>;
}
