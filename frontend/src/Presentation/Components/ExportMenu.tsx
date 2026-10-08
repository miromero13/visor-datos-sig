import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import { ChevronDown, Download, FileSpreadsheet, FileText, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { exportResults, saveFile, type ExportFormat, type ExportRequest, type ExportScope } from "@/Application/Services/exports";

type ExportMenuProps = {
  /** Current query state; null disables the menu (e.g. "Todas las capas"). */
  request: Omit<ExportRequest, "format" | "scope"> | null;
  disabledReason?: string;
  onError: (message: string) => void;
  /** Opens the custom report builder; when given, the menu stays available even if quick exports are not. */
  onCustomReport?: () => void;
};

const formats: Array<{ format: ExportFormat; label: string; icon: typeof FileText }> = [
  { format: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { format: "pdf", label: "PDF", icon: FileText }
];
const scopes: Array<{ scope: ExportScope; label: string }> = [
  { scope: "page", label: "Página actual" },
  { scope: "all", label: "Todos los resultados" }
];
const itemClass = "flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-800";

export function ExportMenu({ request, disabledReason, onError, onCustomReport }: ExportMenuProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (format: ExportFormat, scope: ExportScope) => {
    if (!request) return;
    setBusy(`${format}-${scope}`);
    onError("");
    try { saveFile(await exportResults({ ...request, format, scope })); }
    catch (e) { onError(e instanceof Error ? e.message : "No se pudo generar el archivo."); }
    finally { setBusy(null); }
  };

  const disabled = (!request && !onCustomReport) || busy !== null;
  return <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild disabled={disabled}>
      <button type="button" className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" title={disabled && !request ? disabledReason : undefined} aria-busy={busy !== null}>
        {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
        {busy ? "Generando…" : "Exportar"}
        <ChevronDown size={15} className="text-slate-400" aria-hidden="true" />
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-[230px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
        {formats.map(({ format, label, icon: Icon }, index) => <DropdownMenu.Group key={format}>
          {index > 0 && <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />}
          <DropdownMenu.Label className="flex items-center gap-2 px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><Icon size={14} aria-hidden="true" />{label}</DropdownMenu.Label>
          {scopes.map(({ scope, label: scopeLabel }) => <DropdownMenu.Item key={scope} className={itemClass} disabled={!request} onSelect={() => void run(format, scope)}>
            {scopeLabel}<span className="sr-only"> en {label}</span>
          </DropdownMenu.Item>)}
        </DropdownMenu.Group>)}
        <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
        {!request && disabledReason && <p className="m-0 px-2.5 pb-1 pt-1.5 text-[11px] text-slate-500">{disabledReason}</p>}
        <DropdownMenu.Item className={itemClass} disabled={!onCustomReport} onSelect={() => onCustomReport?.()}>
          <SlidersHorizontal size={15} aria-hidden="true" />Reporte personalizado…
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
