import { afterEach, describe, expect, it, vi } from "vitest";
import { getAllFixedCodeFeatures, getLayerDetail, getLayerFeatures, MAX_FIXED_PAGE_SIZE } from "./layers";

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("map layer requests", () => {
  it("keeps ordinary GeoJSON full by default and opts in only when requested", async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ type: "FeatureCollection", features: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await getLayerFeatures("Lotes");
    await getLayerFeatures("Lotes", {}, { minimal: true });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/layers/Lotes/geojson?limit=1000");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("minimal=true");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/layers/Lotes/geojson?limit=1000&minimal=true");
  });

  it("keeps fixed-code cursor pages full by default and opts into minimal on every page", async () => {
    const emptyPage = { type: "FeatureCollection", features: [], numberReturned: 0, limit: 1000, srid: 4326, hasMore: false, nextAfterId: null };
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse(emptyPage));
    vi.stubGlobal("fetch", fetchMock);
    await getAllFixedCodeFeatures({}, new AbortController().signal);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/layers/CodigosFijos/geojson?limit=1000&afterId=0");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("minimal=true");
    fetchMock.mockClear();
    await getAllFixedCodeFeatures({}, new AbortController().signal, { minimal: true });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/layers/CodigosFijos/geojson?limit=1000&afterId=0&minimal=true");
  });

  it("publishes validated pages with configurable size before fetching the next page", async () => {
    const page = (ids: number[], hasMore: boolean) => ({ type: "FeatureCollection", features: ids.map(id => ({ type: "Feature" as const, id, geometry: null, properties: {} })), numberReturned: ids.length, limit: 2, srid: 4326, hasMore, nextAfterId: ids.at(-1) ?? null });
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(page([3, 4], true))).mockResolvedValueOnce(jsonResponse(page([7], false)));
    vi.stubGlobal("fetch", fetchMock);
    const published: number[] = [];
    const all = await getAllFixedCodeFeatures({}, new AbortController().signal, { pageSize: 2, onPage: async (value, count) => { published.push(value.features[0].id); expect(count).toBe(published.length === 1 ? 2 : 3); expect(fetchMock).toHaveBeenCalledTimes(published.length); await Promise.resolve(); } });
    expect(published).toEqual([3, 7]);
    expect(all.features.map(feature => feature.id)).toEqual([3, 4, 7]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("limit=2");
    expect(MAX_FIXED_PAGE_SIZE).toBe(5000);
  });

  it("waits for callback backpressure and aborts without starting another request", async () => {
    const controller = new AbortController();
    const page = { type: "FeatureCollection", features: [{ type: "Feature", id: 1, geometry: null, properties: {} }], numberReturned: 1, limit: 1, srid: 4326, hasMore: true, nextAfterId: 1 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(page));
    vi.stubGlobal("fetch", fetchMock);
    let release!: () => void;
    const callback = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
    const result = getAllFixedCodeFeatures({}, controller.signal, { pageSize: 1, onPage: callback });
    await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    controller.abort();
    release();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects out-of-range sizes before fetching and stops when a callback fails", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getAllFixedCodeFeatures({}, new AbortController().signal, { pageSize: 5001 })).rejects.toThrow(/pageSize/);
    expect(fetchMock).not.toHaveBeenCalled();
    const page = { type: "FeatureCollection", features: [], numberReturned: 0, limit: 1, srid: 4326, hasMore: false, nextAfterId: null };
    fetchMock.mockResolvedValue(jsonResponse(page));
    const failure = new Error("consumer failed");
    await expect(getAllFixedCodeFeatures({}, new AbortController().signal, { pageSize: 1, onPage: async () => { throw failure; } })).rejects.toBe(failure);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not publish a page whose cursor metadata is inconsistent", async () => {
    const page = { type: "FeatureCollection", features: [{ type: "Feature", id: 1, geometry: null, properties: {} }], numberReturned: 1, limit: 1, srid: 4326, hasMore: false, nextAfterId: 2 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(page));
    vi.stubGlobal("fetch", fetchMock);
    const callback = vi.fn();
    await expect(getAllFixedCodeFeatures({}, new AbortController().signal, { pageSize: 1, onPage: callback })).rejects.toThrow(/cursor inconsistente/);
    expect(callback).not.toHaveBeenCalled();
  });

  it("fetches a full layer detail by feature id and forwards cancellation", async () => {
    const detail = { type: "Feature", id: 12, geometry: null, properties: { Estado: 1, Nombre: "Completo" } };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detail));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await expect(getLayerDetail("CodigosFijos", 12, controller.signal)).resolves.toEqual(detail);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/layers/CodigosFijos/12");
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
