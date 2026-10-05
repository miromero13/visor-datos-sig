import type { Feature } from "@/Application/Services/layers";

export const MAX_FEATURES_PER_FRAME = 200;
export const DRAW_BUDGET_MS = 8;
type FrameScheduler = { request: (callback: (time: number) => void) => number; cancel: (id: number) => void; now: () => number };
const browserFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
  now: () => performance.now(),
};

export function appendFeaturesProgressively(
  features: Feature[],
  append: (feature: Feature) => void,
  signal: AbortSignal,
  onProgress?: (drawn: number) => void,
  scheduler: FrameScheduler = browserFrames,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let frame: number | null = null;
    let index = 0;
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener("abort", abort);
      if (frame !== null) scheduler.cancel(frame);
      frame = null;
    };
    const fail = (error: unknown) => { if (settled) return; settled = true; cleanup(); reject(error); };
    const abort = () => fail(new DOMException("Drawing cancelled", "AbortError"));
    const schedule = () => {
      if (signal.aborted) { abort(); return; }
      frame = scheduler.request(() => {
        frame = null;
        const start = scheduler.now();
        let added = 0;
        try {
          while (index < features.length && added < MAX_FEATURES_PER_FRAME && (added === 0 || scheduler.now() - start < DRAW_BUDGET_MS)) {
            if (signal.aborted) { abort(); return; }
            append(features[index++]);
            added++;
          }
          onProgress?.(index);
        } catch (error) { fail(error); return; }
        if (index < features.length) schedule();
        else { settled = true; cleanup(); resolve(); }
      });
    };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    if (!features.length) { cleanup(); resolve(); } else schedule();
  });
}
