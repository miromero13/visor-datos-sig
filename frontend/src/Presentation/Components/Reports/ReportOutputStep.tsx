import { FileSpreadsheet, FileText } from "lucide-react";
import type { ReportDefinition } from "@/Application/Services/reports";
import { fieldClass, hintClass, labelClass, sectionTitle } from "./reportStyles";

type Props = { definition: ReportDefinition; onChange: (patch: Partial<ReportDefinition>) => void };

const formats = [
  { value: "xlsx" as const, label: "Excel", description: "Para filtrar y calcular. Incluye autofiltro y subtotales.", icon: FileSpreadsheet },
  { value: "pdf" as const, label: "PDF", description: "Para imprimir o compartir. Encabezado, pie y páginas numeradas.", icon: FileText }
];

/** File format, page orientation, title and the optional parameters sheet. */
export function ReportOutputStep({ definition, onChange }: Props) {
  return <div className="grid gap-6">
    <fieldset className="m-0 grid gap-3 border-0 p-0">
      <legend className={`${sectionTitle} mb-3`}>Formato</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {formats.map(({ value, label, description, icon: Icon }) => {
          const active = definition.format === value;
          return <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${active ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/15" : "border-slate-200 hover:bg-slate-50"}`}>
            <input type="radio" name="report-format" value={value} checked={active} onChange={() => onChange({ format: value })} className="mt-1 accent-blue-600" />
            <Icon size={20} className={active ? "text-blue-700" : "text-slate-500"} aria-hidden="true" />
            <span><span className="block text-sm font-semibold text-slate-800">{label}</span><span className="block text-xs text-slate-500">{description}</span></span>
          </label>;
        })}
      </div>
    </fieldset>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClass}>Título del reporte (opcional)
        <input className={fieldClass} value={definition.title ?? ""} maxLength={120} onChange={e => onChange({ title: e.target.value })} placeholder="Ej.: Códigos fijos para corte" />
      </label>
      <label className={labelClass}>Orientación de página
        <select className={fieldClass} value={definition.orientation} disabled={definition.format !== "pdf"} onChange={e => onChange({ orientation: e.target.value as ReportDefinition["orientation"] })}>
          <option value="auto">Automática (horizontal con más de 6 columnas)</option>
          <option value="portrait">Vertical</option>
          <option value="landscape">Horizontal</option>
        </select>
        {definition.format !== "pdf" && <span className="text-[11px] font-normal text-slate-400">Solo aplica al PDF.</span>}
      </label>
    </div>
    <label className={`flex items-start gap-2.5 text-sm ${definition.format === "xlsx" ? "cursor-pointer text-slate-700" : "text-slate-400"}`}>
      <input type="checkbox" className="mt-0.5 size-4 accent-blue-600" disabled={definition.format !== "xlsx"} checked={definition.includeParameters} onChange={e => onChange({ includeParameters: e.target.checked })} />
      <span>Agregar una hoja “Parámetros” con los filtros, el orden y quién generó el reporte<span className={`${hintClass} block`}>Solo aplica al Excel. El PDF siempre muestra el resumen en el encabezado.</span></span>
    </label>
  </div>;
}
