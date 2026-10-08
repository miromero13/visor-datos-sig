import { Plus, Trash2 } from "lucide-react";
import type { ReportField, ReportSort } from "@/Application/Services/reports";
import { fieldClass, hintClass, iconButton, labelClass, secondaryButton, sectionTitle } from "./reportStyles";

type Props = { fields: ReportField[]; groupBy: string | null; sort: ReportSort[]; onGroupChange: (key: string | null) => void; onSortChange: (sort: ReportSort[]) => void };

/** Group by one field (with subtotals) and sort by up to three fields. */
export function ReportOrderStep({ fields, groupBy, sort, onGroupChange, onSortChange }: Props) {
  const groupable = fields.filter(f => f.groupable);
  const update = (index: number, patch: Partial<ReportSort>) => onSortChange(sort.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const nextField = fields.find(f => !sort.some(s => s.field === f.key));

  return <div className="grid gap-6">
    <div className="grid gap-3">
      <div><h3 className={sectionTitle}>Agrupar</h3><p className={hintClass}>Cada grupo muestra sus registros y una fila de subtotal con la cantidad.</p></div>
      <label className={`${labelClass} max-w-sm`}>Agrupar por
        <select className={fieldClass} value={groupBy ?? ""} onChange={e => onGroupChange(e.target.value || null)}>
          <option value="">Sin agrupar</option>
          {groupable.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </label>
    </div>
    <div className="grid gap-3">
      <div><h3 className={sectionTitle}>Ordenar</h3><p className={hintClass}>{groupBy ? "Dentro de cada grupo, los registros se ordenan así." : "Si no elegís un orden, se usa el identificador."}</p></div>
      <ol className="m-0 grid list-none gap-2 p-0" aria-label="Criterios de orden">
        {sort.map((s, index) => <li key={index} className="flex flex-wrap items-end gap-2">
          <span className="mb-2.5 w-14 text-xs font-medium text-slate-500">{index === 0 ? "Primero" : "Luego"}</span>
          <label className={`${labelClass} min-w-[180px] flex-1`}>Campo
            <select className={fieldClass} value={s.field} onChange={e => update(index, { field: e.target.value })} aria-label={`Orden ${index + 1}: campo`}>
              {fields.filter(f => f.key === s.field || !sort.some(o => o.field === f.key)).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </label>
          <label className={`${labelClass} w-40`}>Sentido
            <select className={fieldClass} value={s.direction} onChange={e => update(index, { direction: e.target.value as ReportSort["direction"] })} aria-label={`Orden ${index + 1}: sentido`}>
              <option value="asc">Ascendente (A→Z, 1→9)</option><option value="desc">Descendente (Z→A, 9→1)</option>
            </select>
          </label>
          <button type="button" className={`${iconButton} mb-1`} onClick={() => onSortChange(sort.filter((_, i) => i !== index))} aria-label={`Quitar orden ${index + 1}`}><Trash2 size={16} /></button>
        </li>)}
      </ol>
      <div>
        <button type="button" className={secondaryButton} disabled={sort.length >= 3 || !nextField} onClick={() => nextField && onSortChange([...sort, { field: nextField.key, direction: "asc" }])}>
          <Plus size={16} aria-hidden="true" />Agregar orden
        </button>
      </div>
    </div>
  </div>;
}
