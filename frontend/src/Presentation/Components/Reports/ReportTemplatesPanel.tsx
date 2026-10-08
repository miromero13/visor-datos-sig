import { useState } from "react";
import { FolderOpen, Trash2 } from "lucide-react";
import type { ReportLayer, ReportTemplate } from "@/Application/Services/reports";

type Props = {
  templates: ReportTemplate[];
  layers: ReportLayer[];
  activeId: number | null;
  loading: boolean;
  onOpen: (template: ReportTemplate) => void;
  onDelete: (template: ReportTemplate) => Promise<void>;
};

/** The user's saved report templates: open one to edit or run it, or delete it after confirming. */
export function ReportTemplatesPanel({ templates, layers, activeId, loading, onOpen, onDelete }: Props) {
  const [confirming, setConfirming] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const title = (id: string) => layers.find(l => l.id === id)?.title ?? id;

  const remove = async (template: ReportTemplate) => {
    setDeleting(template.id);
    try { await onDelete(template); } finally { setDeleting(null); setConfirming(null); }
  };

  return <section aria-label="Mis plantillas" className="grid gap-2">
    <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mis plantillas</p>
    {loading && <p className="m-0 text-xs text-slate-500">Cargando…</p>}
    {!loading && templates.length === 0 && <p className="m-0 text-xs text-slate-500">Todavía no guardaste plantillas. Configurá un reporte y guardalo para reutilizarlo.</p>}
    <ul className="m-0 grid list-none gap-1 p-0">
      {templates.map(template => <li key={template.id} className={`rounded-md border px-2.5 py-2 ${template.id === activeId ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}>
        <p className="m-0 truncate text-sm font-medium text-slate-800" title={template.name}>{template.name}</p>
        <p className="m-0 text-[11px] text-slate-500">{title(template.layer)} · {template.definition.format === "pdf" ? "PDF" : "Excel"}</p>
        {confirming === template.id
          ? <div className="mt-1.5 flex items-center gap-2 text-xs">
              <span className="text-slate-600">¿Eliminar?</span>
              <button type="button" className="cursor-pointer rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-60" disabled={deleting === template.id} onClick={() => void remove(template)}>Sí, eliminar</button>
              <button type="button" className="cursor-pointer rounded px-2 py-1 text-slate-600 hover:bg-slate-100" onClick={() => setConfirming(null)}>No</button>
            </div>
          : <div className="mt-1.5 flex gap-1">
              <button type="button" className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100" onClick={() => onOpen(template)} aria-label={`Abrir plantilla ${template.name}`}><FolderOpen size={13} aria-hidden="true" />Abrir</button>
              <button type="button" className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirming(template.id)} aria-label={`Eliminar plantilla ${template.name}`}><Trash2 size={13} aria-hidden="true" />Eliminar</button>
            </div>}
      </li>)}
    </ul>
  </section>;
}
