import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetReportJobs, trackReportJob } from "@/Application/Services/reportJobs";
import { ReportJobsNotice } from "./ReportJobsNotice";

const mocks = vi.hoisted(() => ({ getReportJob: vi.fn(), downloadReportJob: vi.fn(), saveFile: vi.fn() }));
vi.mock("@/Application/Services/reports", () => ({ getReportJob: mocks.getReportJob, downloadReportJob: mocks.downloadReportJob }));
vi.mock("@/Application/Services/exports", () => ({ saveFile: mocks.saveFile }));

const queued = { id: "job-1", status: "queued" as const, title: "Reporte de lotes", layer: "Lotes" as const, format: "xlsx" as const, fileName: null, error: null, createdAt: "", completedAt: null };

describe("ReportJobsNotice", () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); Object.values(mocks).forEach(m => m.mockReset()); sessionStorage.clear(); });
  afterEach(() => { act(() => resetReportJobs()); vi.useRealTimers(); });

  it("polls a background report and offers the download when it is ready", async () => {
    mocks.getReportJob.mockResolvedValueOnce({ ...queued, status: "running" }).mockResolvedValue({ ...queued, status: "completed", fileName: "reporte_lotes.xlsx" });
    mocks.downloadReportJob.mockResolvedValue({ blob: new Blob(), fileName: "reporte_lotes.xlsx" });
    render(<ReportJobsNotice />);
    act(() => trackReportJob(queued));
    expect(screen.getByText("En cola…")).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    expect(await screen.findByText("Generando…")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    await userEvent.click(await screen.findByRole("button", { name: /descargar excel/i }));

    await waitFor(() => expect(mocks.saveFile).toHaveBeenCalledWith({ blob: expect.any(Blob), fileName: "reporte_lotes.xlsx" }));
    expect(screen.queryByText("Reporte de lotes")).not.toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem("visordatossig.reportJobs")!)).toEqual([]);
  });

  it("shows why a background report failed", async () => {
    mocks.getReportJob.mockResolvedValue({ ...queued, status: "failed", error: "No se pudo generar el reporte. Intentá nuevamente." });
    render(<ReportJobsNotice />);
    act(() => trackReportJob(queued));
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    expect(await screen.findByText("No se pudo generar el reporte. Intentá nuevamente.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /cerrar aviso/i }));
    expect(screen.queryByText("Reporte de lotes")).not.toBeInTheDocument();
  });
});
