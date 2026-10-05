import { afterEach, describe, expect, it, vi } from "vitest";
import { getAllFixedCodeFeatures, getLayerDetail, getLayerFeatures } from "./layers";

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
