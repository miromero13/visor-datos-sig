import { Plus, Trash2 } from "lucide-react";
import { operatorLabels, type FilterOperator, type ReportField, type ReportFilter } from "@/Application/Services/reports";
import { fieldClass, hintClass, iconButton, labelClass, secondaryButton, sectionTitle } from "./reportStyles";

type Props = { fields: ReportField[]; q: string; filters: ReportFilter[]; onQueryChange: (q: string) => void; onChange: (filters: ReportFilter[]) => void };

const inputType = (field: ReportField) => field.filterKind === "date" ? "date" : "text";
const inputMode = (field: ReportField) => field.filterKind === "text" || field.filterKind === "date" ? undefined : field.filterKind === "integer" ? "numeric" as const : "decimal" as const;

/** Search text plus typed conditions; the backend validates every field, operator and value again. */
export function ReportFiltersStep({ fields, q, filters, onQueryChange, onChange }: Props) {
  const update = (index: number, patch: Partial<ReportFilter>) => onChange(filters.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  const changeField = (index: number, key: string) => {
    const field = fields.find(f => f.key === key)!;
    update(index, { field: key, operator: field.operators[0], value: "", valueTo: "", values: [] });
  };

  return <div className="grid gap-5">
    <div className="grid gap-1">
      <h3 className={sectionTitle}>Filtros</h3>
      <p className={hintClass}>Todas las condiciones se combinan: el reporte incluye solo los registros que cumplen todas.</p>
    </div>
    <label className={labelClass}>Búsqueda de texto (opcional)
      <input className={fieldClass} value={q} maxLength={200} onChange={e => onQueryChange(e.target.value)} placeholder="Código, nombre, lote o vía" />
    </label>
    <ul className="m-0 grid list-none gap-2 p-0" aria-label="Condiciones">
      {filters.map((filter, index) => {
        const field = fields.find(f => f.key === filter.field) ?? fields[0];
        const name = `Condición ${index + 1}`;
        return <li key={index} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[minmax(150px,1fr)_minmax(130px,.8fr)_minmax(180px,1.4fr)_auto] sm:items-end">
          <label className={labelClass}>Campo
            <select className={fieldClass} value={field.key} onChange={e => changeField(index, e.target.value)} aria-label={`${name}: campo`}>
              {fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>Condición
            <select className={fieldClass} value={filter.operator} onChange={e => update(index, { operator: e.target.value as FilterOperator })} aria-label={`${name}: condición`}>
              {field.operators.map(op => <option key={op} value={op}>{operatorLabels[op]}</option>)}
            </select>
          </label>
          <div className={labelClass}>
            <span>Valor</span>
            {filter.operator === "in" && field.options
              ? <div className="flex flex-wrap gap-x-3 gap-y-1.5 py-1" role="group" aria-label={`${name}: valores`}>
                  {field.options.map(option => <label key={option.value} className="flex cursor-pointer items-center gap-1.5 text-sm font-normal text-slate-700">
                    <input type="checkbox" className="size-4 accent-blue-600" checked={filter.values?.includes(option.value) ?? false}
                      onChange={e => update(index, { values: e.target.checked ? [...(filter.values ?? []), option.value] : (filter.values ?? []).filter(v => v !== option.value) })} />
                    {option.label}
                  </label>)}
                </div>
              : filter.operator === "in"
                ? <input className={fieldClass} value={(filter.values ?? []).join(", ")} onChange={e => update(index, { values: e.target.value.split(",").map(v => v.trim()) })} placeholder="Separá los valores con comas" aria-label={`${name}: valores`} />
                : field.options
                  ? <select className={fieldClass} value={filter.value ?? ""} onChange={e => update(index, { value: e.target.value })} aria-label={`${name}: valor`}>
                      <option value="">Elegí un valor</option>{field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  : <div className="flex items-center gap-2">
                      <input className={fieldClass} type={inputType(field)} inputMode={inputMode(field)} value={filter.value ?? ""} onChange={e => update(index, { value: e.target.value })} aria-label={filter.operator === "between" ? `${name}: desde` : `${name}: valor`} />
                      {filter.operator === "between" && <>
                        <span className="text-xs text-slate-500">y</span>
                        <input className={fieldClass} type={inputType(field)} inputMode={inputMode(field)} value={filter.valueTo ?? ""} onChange={e => update(index, { valueTo: e.target.value })} aria-label={`${name}: hasta`} />
                      </>}
                    </div>}
          </div>
          <button type="button" className={iconButton} onClick={() => onChange(filters.filter((_, i) => i !== index))} aria-label={`Quitar ${name}`}><Trash2 size={16} /></button>
        </li>;
      })}
    </ul>
    <div>
      <button type="button" className={secondaryButton} disabled={filters.length >= 15} onClick={() => onChange([...filters, { field: fields[0].key, operator: fields[0].operators[0], value: "", valueTo: "", values: [] }])}>
        <Plus size={16} aria-hidden="true" />Agregar condición
      </button>
    </div>
  </div>;
}
