import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeShapefileSources } from "./shapefileSources";

afterEach(() => vi.unstubAllGlobals());

describe("analyzeShapefileSources", () => {
  it("posts selected files as multipart and returns backend analysis", async () => {
    const layers = [{ name: "Roads", files: ["Roads.SHP"], missingExtensions: [".prj"], complete: false }];
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ layers }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const file = new File(["content"], "Roads.SHP");
    await expect(analyzeShapefileSources([file])).resolves.toEqual(layers);
    expect(fetch).toHaveBeenCalledWith("/api/shapefile-sources/analyze", expect.objectContaining({ method: "POST" }));
    expect((fetch.mock.calls[0][1].body as FormData).get("files")).toMatchObject({ name: "Roads.SHP" });
  });

  it("reports oversized requests and network failures clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 413 })));
    await expect(analyzeShapefileSources([])).rejects.toThrow(/excede el límite/i);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(analyzeShapefileSources([])).rejects.toThrow(/conectar con la API/i);
  });
});
