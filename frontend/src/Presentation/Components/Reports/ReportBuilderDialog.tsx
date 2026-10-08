import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { Columns3, Download, Eye, Filter, LoaderCircle, RotateCcw, Save, Settings2, SlidersHorizontal, X } from "lucide-react";
import type { LayerId } from "@/Application/Services/layers";
import { saveFile } from "@/Application/Services/exports";
import {
  completeDefinition, createTemplate, deleteTemplate, exportReport, getReportFields, listTemplates, previewReport, updateTemplate,
  type ReportDefinition, type ReportFilter, type ReportLayer, type ReportPreview, type ReportTemplate
} from "@/Application/Services/reports";
import { trackReportJob } from "@/Application/Services/reportJobs";
import { ReportColumnsStep } from "./ReportColumnsStep";
import { ReportFiltersStep } from "./ReportFiltersStep";
import { ReportOrderStep } from "./ReportOrderStep";
import { ReportOutputStep } from "./ReportOutputStep";
import { ReportPreviewStep } from "./ReportPreviewStep";
import { ReportTemplatesPanel } from "./ReportTemplatesPanel";
import { fieldClass, primaryButton, secondaryButton } from "./reportStyles";

export type ReportBuilderInitial = { layer?: LayerId; q?: string; filters?: Record<string, string> };
type Props = { open: boolean; onOpenChange: (open: boolean) => void; initial?: ReportBuilderInitial };
type Step = "columns" | "filters" | "order" | "output" | "preview";

const steps: Array<{ id: Step; label: string; icon: typeof Columns3 }> = [
  { id: "columns", label: "Columnas", icon: Columns3 },
  { id: "filters", label: "Filtros", icon: Filter },
  { id: "order", label: "Agrupar y ordenar", icon: SlidersHorizontal },
  { id: "output", label: "Formato", icon: Settings2 },
  { id: "preview", label: "Vista previa", icon: Eye }
];

/** Screen filters become builder conditions: text fields keep "contains", numbers and lists become exact matches. */
function fromScreen(layer: ReportLayer, initial?: ReportBuilderInitial): ReportDefinition {
  const filters: ReportFilter[] = Object.entries(initial?.filters ?? {})
    .filter(([, value]) => value.trim())
    .flatMap(([key, value]) => {
      const field = layer.fields.find(f => f.key.toLowerCase() === key.toLowerCase());
      if (!field) return [];
      return [{ field: field.key, operator: field.filterKind === "text" && !field.options ? "contains" : "equals", value: value.trim() } as ReportFilter];
    });
  return completeDefinition({ layer: layer.id, q: initial?.q?.trim() ?? "", filters }, layer);
}

/** Request body: drops empty list values and blank optional text so the backend validates only what the user set. */
function toRequest(definition: ReportDefinition): ReportDefinition {
  return {
    ...definition,
    q: definition.q?.trim() || undefined,
    title: definition.title?.trim() || null,
    filters: definition.filters.map(f => ({ ...f, values: f.operator === "in" ? (f.values ?? []).filter(v => v.trim()) : undefined }))
  };
}

export function ReportBuilderDialog({ open, onOpenChange, initial }: Props) {
  const [layers, setLayers] = useState<ReportLayer[]>([]);
  const [definition, setDefinition] = useState<ReportDefinition | null>(null);
  const [step, setStep] = useState<Step>("columns");
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<ReportTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [busy, setBusy] = useState<"preview" | "export" | "save" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const definitionRef = useRef(definition);
  definitionRef.current = definition;

  // The configuration survives closing and reopening the dialog (e.g. to watch a background report), so the
  // next export uses what the user chose; "Empezar de nuevo" goes back to the query screen state.
  useEffect(() => {
    if (!open) return;
    setError(""); setNotice("");
    let cancelled = false;
    (layers.length ? Promise.resolve(layers) : getReportFields()).then(loaded => {
      if (cancelled) return;
      setLayers(loaded);
      if (definitionRef.current) return;
      const layer = loaded.find(l => l.id === initialRef.current?.layer) ?? loaded[0];
      if (layer) setDefinition(fromScreen(layer, initialRef.current));
    }).catch(e => !cancelled && setError(e instanceof Error ? e.message : "No se pudieron cargar los campos."));
    setTemplatesLoading(true);
    listTemplates().then(list => !cancelled && setTemplates(list)).catch(() => { /* The builder still works without templates. */ }).finally(() => !cancelled && setTemplatesLoading(false));
    return () => { cancelled = true; };
    // Reload only when the dialog opens; field metadata is cached in state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const layer = layers.find(l => l.id === definition?.layer);
  const requestKey = useMemo(() => (definition ? JSON.stringify(toRequest(definition)) : ""), [definition]);
  const patch = (changes: Partial<ReportDefinition>) => setDefinition(current => (current ? { ...current, ...changes } : current));

  const startOver = () => {
    const target = layers.find(l => l.id === initialRef.current?.layer) ?? layers[0];
    if (!target) return;
    setDefinition(fromScreen(target, initialRef.current));
    setActiveTemplate(null); setTemplateName(""); setPreview(null); setStep("columns"); setError("");
    setNotice("Empezaste un reporte nuevo con la búsqueda y los filtros de la pantalla.");
  };

  const chooseLayer = (id: LayerId) => {
    const next = layers.find(l => l.id === id);
    if (next && definition) setDefinition(completeDefinition({ layer: id, format: definition.format, orientation: definition.orientation, includeParameters: definition.includeParameters }, next));
    setPreview(null);
  };

  const run = async (kind: "preview" | "export" | "save", action: () => Promise<void>) => {
    setBusy(kind); setError(""); setNotice("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Ocurrió un error inesperado."); } finally { setBusy(null); }
  };

  const refreshPreview = () => definition && run("preview", async () => {
    setStep("preview");
    setPreview(await previewReport(toRequest(definition)));
    setPreviewKey(requestKey);
  });

  const exportNow = () => definition && run("export", async () => {
    const result = await exportReport(toRequest(definition));
    if (result.kind === "file") { saveFile(result.file); setNotice(`Descargaste ${result.file.fileName}.`); return; }
    trackReportJob(result.job);
    setNotice(`El reporte tiene ${result.total.toLocaleString("es-BO")} registros: lo estamos preparando y te avisamos cuando esté listo. Podés cerrar esta ventana.`);
  });

  const save = (asNew: boolean) => definition && run("save", async () => {
    const name = templateName.trim();
    if (!name) throw new Error("Escribí un nombre para la plantilla.");
    const saved = activeTemplate && !asNew ? await updateTemplate(activeTemplate.id, name, toRequest(definition)) : await createTemplate(name, toRequest(definition));
    setTemplates(list => [saved, ...list.filter(t => t.id !== saved.id)]);
    setActiveTemplate(saved);
    setNotice(activeTemplate && !asNew ? `Actualizaste la plantilla “${saved.name}”.` : `Guardaste la plantilla “${saved.name}”.`);
  });

  const openTemplate = (template: ReportTemplate) => {
    const target = layers.find(l => l.id === template.layer);
    setDefinition(completeDefinition(template.definition, target));
    setActiveTemplate(template); setTemplateName(template.name); setPreview(null); setStep("columns"); setError("");
    setNotice(`Abriste la plantilla “${template.name}”. Podés exportarla o modificarla y guardar los cambios.`);
  };

  const removeTemplate = async (template: ReportTemplate) => {
    try {
      await deleteTemplate(template.id);
      setTemplates(list => list.filter(t => t.id !== template.id));
      if (activeTemplate?.id === template.id) { setActiveTemplate(null); setTemplateName(""); }
      setNotice(`Eliminaste la plantilla “${template.name}”.`);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo eliminar la plantilla."); }
  };

  const tooLarge = preview && previewKey === requestKey && preview.total > preview.maxRows;
  const canRun = Boolean(definition && definition.columns.length > 0) && busy === null;

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xs" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex h-[min(92vh,780px)] w-[min(1080px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white text-slate-900 shadow-2xl outline-none" aria-describedby="report-builder-description">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <Dialog.Title className="m-0 text-lg font-semibold">Reporte personalizado{activeTemplate && <span className="ml-2 text-sm font-normal text-slate-500">· {activeTemplate.name}</span>}</Dialog.Title>
            <Dialog.Description id="report-builder-description" className="m-0 mt-0.5 text-sm text-slate-500">Elegí columnas, filtros, agrupación y formato. Guardalo como plantilla para reutilizarlo.</Dialog.Description>
          </div>
          <Dialog.Close className="cursor-pointer rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Cerrar"><X size={18} /></Dialog.Close>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[230px_minmax(0,1fr)] md:grid-rows-1">
          <aside className="flex min-w-0 flex-col gap-3 border-b border-slate-200 bg-slate-50 p-3 md:min-h-0 md:gap-4 md:overflow-y-auto md:border-b-0 md:border-r md:p-4">
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">Capa
              <select className={fieldClass} value={definition?.layer ?? ""} onChange={e => chooseLayer(e.target.value as LayerId)} disabled={!layers.length} aria-label="Capa del reporte">
                {layers.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </label>
            <nav aria-label="Pasos del reporte" className="flex gap-1 overflow-x-auto md:grid">
              {steps.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setStep(id)} aria-current={step === id ? "step" : undefined}
                className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${step === id ? "bg-blue-600 font-semibold text-white" : "text-slate-600 hover:bg-slate-200/70"}`}>
                <Icon size={16} aria-hidden="true" />{label}
              </button>)}
            </nav>
            <button type="button" onClick={startOver} disabled={!layers.length} className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-50">
              <RotateCcw size={13} aria-hidden="true" />Empezar de nuevo
            </button>
            <div className="hidden md:block"><ReportTemplatesPanel templates={templates} layers={layers} activeId={activeTemplate?.id ?? null} loading={templatesLoading} onOpen={openTemplate} onDelete={removeTemplate} /></div>
          </aside>

          <main className="min-h-0 min-w-0 overflow-y-auto p-4 md:p-5">
            {!definition || !layer
              ? <p className="text-sm text-slate-500">{error ? "" : "Cargando campos…"}</p>
              : step === "columns" ? <ReportColumnsStep fields={layer.fields} columns={definition.columns} groupBy={definition.groupBy} onChange={columns => patch({ columns })} />
              : step === "filters" ? <ReportFiltersStep fields={layer.fields} q={definition.q ?? ""} filters={definition.filters} onQueryChange={q => patch({ q })} onChange={filters => patch({ filters })} />
              : step === "order" ? <ReportOrderStep fields={layer.fields} groupBy={definition.groupBy ?? null} sort={definition.sort} onGroupChange={groupBy => patch({ groupBy })} onSortChange={sort => patch({ sort })} />
              : step === "output" ? <ReportOutputStep definition={definition} onChange={patch} />
              : <ReportPreviewStep preview={preview} loading={busy === "preview"} stale={previewKey !== requestKey} onRefresh={() => void refreshPreview()} />}
            <div className="mt-6 md:hidden"><ReportTemplatesPanel templates={templates} layers={layers} activeId={activeTemplate?.id ?? null} loading={templatesLoading} onOpen={openTemplate} onDelete={removeTemplate} /></div>
          </main>
        </div>

        <footer className="grid gap-3 border-t border-slate-200 bg-white px-4 py-3 md:px-5">
          {error && <p className="m-0 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
          {notice && !error && <p className="m-0 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">{notice}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-1">
              <input className={`${fieldClass} h-9 min-w-[150px] flex-1 sm:max-w-[260px]`} value={templateName} maxLength={100} onChange={e => setTemplateName(e.target.value)} placeholder="Nombre de la plantilla" aria-label="Nombre de la plantilla" />
              <button type="button" className={secondaryButton} onClick={() => void save(false)} disabled={!canRun}><Save size={16} aria-hidden="true" />{activeTemplate ? "Guardar cambios" : "Guardar plantilla"}</button>
              {activeTemplate && <button type="button" className={secondaryButton} onClick={() => void save(true)} disabled={!canRun}>Guardar como nueva</button>}
            </div>
            <div className="flex w-full gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
              <button type="button" className={secondaryButton} onClick={() => void refreshPreview()} disabled={!canRun}>
                {busy === "preview" ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}Previsualizar
              </button>
              <button type="button" className={primaryButton} onClick={() => void exportNow()} disabled={!canRun || Boolean(tooLarge)}>
                {busy === "export" ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
                {busy === "export" ? "Generando…" : `Exportar ${definition?.format === "pdf" ? "PDF" : "Excel"}`}
              </button>
            </div>
          </div>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
