import { describe, expect, it, vi } from "vitest";
import { appendFeaturesProgressively, MAX_FEATURES_PER_FRAME } from "./mapProgressiveDrawing";

type Frame = (time: number) => void;
function fakeFrames() {
  const callbacks = new Map<number, Frame>(); let id = 0; let clock = 0;
  return {
    scheduler: { request: (callback: Frame) => { callbacks.set(++id, callback); return id; }, cancel: (key: number) => callbacks.delete(key), now: () => clock },
    tick: (elapsed = 0) => { const [key, callback] = callbacks.entries().next().value ?? []; if (callback) { callbacks.delete(key!); clock += elapsed; callback(clock); } },
    count: () => callbacks.size,
  };
}
describe("progressive drawing scheduler", () => {
  it("bounds each frame and honors the time budget before scheduling another", async () => {
    const raf = fakeFrames(); const append = vi.fn();
    const promise = appendFeaturesProgressively(Array.from({ length: MAX_FEATURES_PER_FRAME + 2 }, (_, id) => ({ id } as never)), append, new AbortController().signal, undefined, raf.scheduler);
    raf.tick(); expect(append).toHaveBeenCalledTimes(MAX_FEATURES_PER_FRAME); expect(raf.count()).toBe(1);
    raf.tick(); await promise; expect(append).toHaveBeenCalledTimes(MAX_FEATURES_PER_FRAME + 2);
  });
  it("rejects on abort and cancels the queued frame", async () => {
    const raf = fakeFrames(); const controller = new AbortController();
    const promise = appendFeaturesProgressively([{ id: 1 } as never], vi.fn(), controller.signal, undefined, raf.scheduler);
    controller.abort(); await expect(promise).rejects.toMatchObject({ name: "AbortError" }); expect(raf.count()).toBe(0);
  });
  it("settles promptly when abort happens during progress or append/progress throws", async () => {
    const raf = fakeFrames(); const controller = new AbortController();
    const duringProgress = appendFeaturesProgressively([{} as never, {} as never], vi.fn(), controller.signal, () => controller.abort(), raf.scheduler);
    raf.tick(); await expect(duringProgress).rejects.toMatchObject({ name: "AbortError" }); expect(raf.count()).toBe(0);
    const appendFailure = new Error("append failed");
    const append = appendFeaturesProgressively([{} as never], () => { throw appendFailure; }, new AbortController().signal, undefined, raf.scheduler);
    raf.tick(); await expect(append).rejects.toBe(appendFailure);
    const progressFailure = new Error("progress failed");
    const progress = appendFeaturesProgressively([{} as never], vi.fn(), new AbortController().signal, () => { throw progressFailure; }, raf.scheduler);
    raf.tick(); await expect(progress).rejects.toBe(progressFailure); expect(raf.count()).toBe(0);
  });
  it("schedules another frame when append time exceeds the budget", async () => {
    const raf = fakeFrames(); let count = 0; let elapsed = 0;
    const append = () => { count++; elapsed += 9; };
    const scheduler = { ...raf.scheduler, now: () => elapsed };
    const promise = appendFeaturesProgressively(Array.from({ length: 3 }, () => ({} as never)), append, new AbortController().signal, undefined, scheduler);
    raf.tick(); expect(count).toBe(1); expect(raf.count()).toBe(1);
    raf.tick(); raf.tick(); await promise; expect(count).toBe(3);
  });
});
