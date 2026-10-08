import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReportField } from "@/Application/Services/reports";
import { hintClass, iconButton, secondaryButton, sectionTitle } from "./reportStyles";

type Props = { fields: ReportField[]; columns: string[]; groupBy?: string | null; onChange: (columns: string[]) => void };

const kindLabels: Record<string, string> = { text: "Texto", integer: "Número", decimal: "Número", coordinate: "Coordenada", currency: "Moneda", date: "Fecha" };

/** Choose and order the report columns; selected columns are listed first, in export order. */
export function ReportColumnsStep({ fields, columns, groupBy, onChange }: Props) {
  const selected = columns.map(key => fields.find(f => f.key === key)).filter((f): f is ReportField => Boolean(f));
  const available = fields.filter(f => !columns.includes(f.key));
  const move = (index: number, delta: number) => {
    const next = [...columns];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };

  return <div className="grid gap-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className={sectionTitle}>Columnas del reporte</h3><p className={hintClass}>Marcá las columnas y ordenalas con las flechas. El archivo las muestra en este orden.</p></div>
      <div className="flex gap-2">
        <button type="button" className={secondaryButton} onClick={() => onChange(fields.map(f => f.key))}>Todas</button>
        <button type="button" className={secondaryButton} onClick={() => onChange([])}>Ninguna</button>
      </div>
    </div>
    <ol className="m-0 grid list-none gap-1.5 p-0" aria-label="Columnas seleccionadas">
      {selected.map((field, index) => <li key={field.key} className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2">
        <input type="checkbox" checked onChange={() => onChange(columns.filter(c => c !== field.key))} className="size-4 cursor-pointer accent-blue-600" aria-label={`Quitar ${field.label}`} />
        <span className="w-6 text-xs font-semibold text-blue-700">{index + 1}</span>
        <span className="flex-1 text-sm font-medium text-slate-800">{field.label}{field.key === groupBy && <span className="ml-2 text-xs font-normal text-blue-700">(agrupa el reporte)</span>}</span>
        <span className="hidden text-xs text-slate-500 sm:inline">{kindLabels[field.kind]}</span>
        <button type="button" className={iconButton} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir ${field.label}`}><ArrowUp size={16} /></button>
        <button type="button" className={iconButton} disabled={index === selected.length - 1} onClick={() => move(index, 1)} aria-label={`Bajar ${field.label}`}><ArrowDown size={16} /></button>
      </li>)}
      {selected.length === 0 && <li className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">Elegí al menos una columna.</li>}
    </ol>
    {available.length > 0 && <div className="grid gap-1.5">
      <p className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-400">Disponibles</p>
      {available.map(field => <label key={field.key} className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50">
        <input type="checkbox" checked={false} onChange={() => onChange([...columns, field.key])} className="size-4 cursor-pointer accent-blue-600" />
        <span className="flex-1 text-sm text-slate-700">{field.label}</span>
        <span className="hidden text-xs text-slate-500 sm:inline">{kindLabels[field.kind]}</span>
      </label>)}
    </div>}
  </div>;
}
