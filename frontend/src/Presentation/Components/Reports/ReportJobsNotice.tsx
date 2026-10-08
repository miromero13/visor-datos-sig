import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Download, LoaderCircle, X } from "lucide-react";
import { saveFile } from "@/Application/Services/exports";
import { downloadReportJob, type ReportJob } from "@/Application/Services/reports";
import { dismissReportJob, resumeReportJobs, useReportJobs } from "@/Application/Services/reportJobs";

const statusText: Record<ReportJob["status"], string> = {
  queued: "En cola…", running: "Generando…", completed: "Listo para descargar", failed: "No se pudo generar"
};

/** Floating notice for reports generated in the background; visible on every authenticated page. */
export function ReportJobsNotice() {
  const jobs = useReportJobs();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});
  useEffect(() => resumeReportJobs(), []);
  if (jobs.length === 0) return null;

  const download = async (job: ReportJob) => {
    setDownloading(job.id);
    try { saveFile(await downloadReportJob(job)); dismissReportJob(job.id); }
    catch (e) { setError(previous => ({ ...previous, [job.id]: e instanceof Error ? e.message : "No se pudo descargar el reporte." })); }
    finally { setDownloading(null); }
  };

  return <section aria-label="Reportes en preparación" className="fixed bottom-4 right-4 z-40 grid w-[min(360px,calc(100vw-32px))] gap-2">
    {jobs.map(job => {
      const done = job.status === "completed";
      const failed = job.status === "failed";
      return <div key={job.id} role="status" className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg">
        <span className="mt-0.5" aria-hidden="true">
          {done ? <CircleCheck size={18} className="text-emerald-600" /> : failed ? <CircleAlert size={18} className="text-red-600" /> : <LoaderCircle size={18} className="animate-spin text-blue-600" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate font-medium text-slate-800">{job.title}</p>
          <p className={`m-0 mt-0.5 text-xs ${failed ? "text-red-700" : "text-slate-500"}`}>{failed ? job.error ?? statusText.failed : statusText[job.status]}</p>
          {error[job.id] && <p className="m-0 mt-1 text-xs text-red-700">{error[job.id]}</p>}
          {done && <button type="button" onClick={() => void download(job)} disabled={downloading === job.id} className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            <Download size={14} aria-hidden="true" />{downloading === job.id ? "Descargando…" : `Descargar ${job.format === "pdf" ? "PDF" : "Excel"}`}
          </button>}
        </div>
        {(done || failed) && <button type="button" onClick={() => dismissReportJob(job.id)} className="cursor-pointer rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Cerrar aviso de ${job.title}`}><X size={16} /></button>}
      </div>;
    })}
  </section>;
}
