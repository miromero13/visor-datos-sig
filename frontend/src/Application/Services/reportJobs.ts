import { useSyncExternalStore } from "react";
import { getReportJob, type ReportJob } from "./reports";

/**
 * Tracks background report jobs for the whole app: polls the API until each job finishes and keeps the list in
 * sessionStorage so a page reload does not lose a report that is still being prepared.
 */
const STORAGE_KEY = "visordatossig.reportJobs";
const POLL_MS = 2000;
let jobs: ReportJob[] = load();
const listeners = new Set<() => void>();
const timers = new Map<string, number>();

function load(): ReportJob[] {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as ReportJob[]; } catch { return []; }
}

function save() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobs)); } catch { /* Storage is optional. */ }
}

function emit() {
  save();
  listeners.forEach(listener => listener());
}

function upsert(job: ReportJob) {
  jobs = jobs.some(j => j.id === job.id) ? jobs.map(j => (j.id === job.id ? job : j)) : [job, ...jobs];
  emit();
}

function notifyReady(job: ReportJob) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden)
      new Notification("Tu reporte está listo", { body: job.fileName ?? job.title });
  } catch { /* Browser notifications are a bonus; the in-app notice is the primary signal. */ }
}

function poll(id: string) {
  if (timers.has(id)) return;
  const tick = async () => {
    try {
      const job = await getReportJob(id);
      upsert(job);
      if (job.status === "completed") notifyReady(job);
      if (job.status === "completed" || job.status === "failed") { timers.delete(id); return; }
    } catch (e) {
      const current = jobs.find(j => j.id === id);
      if (current) upsert({ ...current, status: "failed", error: e instanceof Error ? e.message : "No se pudo consultar el reporte." });
      timers.delete(id);
      return;
    }
    timers.set(id, window.setTimeout(tick, POLL_MS));
  };
  timers.set(id, window.setTimeout(tick, POLL_MS));
}

export function trackReportJob(job: ReportJob) {
  upsert(job);
  try { if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission(); } catch { /* Optional. */ }
  poll(job.id);
}

export function dismissReportJob(id: string) {
  window.clearTimeout(timers.get(id));
  timers.delete(id);
  jobs = jobs.filter(j => j.id !== id);
  emit();
}

/** Resumes polling for jobs restored from sessionStorage. */
export function resumeReportJobs() {
  jobs.filter(j => j.status === "queued" || j.status === "running").forEach(j => poll(j.id));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useReportJobs = () => useSyncExternalStore(subscribe, () => jobs);

/** Test helper: clears jobs and timers between tests. */
export function resetReportJobs() {
  timers.forEach(timer => window.clearTimeout(timer));
  timers.clear();
  jobs = [];
  emit();
}
