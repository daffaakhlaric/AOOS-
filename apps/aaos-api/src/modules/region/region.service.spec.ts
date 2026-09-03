import { describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("RegionService", () => {
  it("getProvinces returns real {id, nama} entries, dropping latitude/longitude", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse([
          { id: "11", nama: "Aceh", latitude: 0, longitude: 0 },
          { id: "12", nama: "Sumatera Utara", latitude: 0, longitude: 0 },
        ]),
      ),
    );
    const { RegionService } = await import("./region.service.js");
    const service = new RegionService();
    const result = await service.getProvinces();
    expect(result).toEqual([
      { id: "11", nama: "Aceh" },
      { id: "12", nama: "Sumatera Utara" },
    ]);
    vi.unstubAllGlobals();
  });

  it("getRegencies calls the real kabupaten/:provinceId.json endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([{ id: "1101", nama: "Kabupaten Aceh Selatan", latitude: 0, longitude: 0 }]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { RegionService } = await import("./region.service.js");
    const service = new RegionService();
    const result = await service.getRegencies("11");
    expect(result).toEqual([{ id: "1101", nama: "Kabupaten Aceh Selatan" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ibnux.github.io/data-indonesia/kabupaten/11.json",
    );
    vi.unstubAllGlobals();
  });

  it("getDistricts calls the real kecamatan/:regencyId.json endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([{ id: "110101", nama: "Bakongan", latitude: 0, longitude: 0 }]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { RegionService } = await import("./region.service.js");
    const service = new RegionService();
    const result = await service.getDistricts("1101");
    expect(result).toEqual([{ id: "110101", nama: "Bakongan" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ibnux.github.io/data-indonesia/kecamatan/1101.json",
    );
    vi.unstubAllGlobals();
  });

  it("caches getProvinces — a second call does not re-fetch", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([{ id: "11", nama: "Aceh" }]));
    vi.stubGlobal("fetch", fetchMock);
    const { RegionService } = await import("./region.service.js");
    const service = new RegionService();
    await service.getProvinces();
    await service.getProvinces();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("real, honest degrade: network failure throws UnavailableError, never a fabricated fallback list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ENOTFOUND");
      }),
    );
    const { RegionService } = await import("./region.service.js");
    const { UnavailableError } = await import("@aos/errors");
    const service = new RegionService();
    await expect(service.getProvinces()).rejects.toBeInstanceOf(UnavailableError);
    vi.unstubAllGlobals();
  });

  it("real, honest degrade: a non-2xx upstream response throws UnavailableError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "not found" }, 404)),
    );
    const { RegionService } = await import("./region.service.js");
    const { UnavailableError } = await import("@aos/errors");
    const service = new RegionService();
    await expect(service.getRegencies("99")).rejects.toBeInstanceOf(UnavailableError);
    vi.unstubAllGlobals();
  });

  it("real, honest degrade: a malformed (non-array) body throws UnavailableError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ not: "an array" })),
    );
    const { RegionService } = await import("./region.service.js");
    const { UnavailableError } = await import("@aos/errors");
    const service = new RegionService();
    await expect(service.getProvinces()).rejects.toBeInstanceOf(UnavailableError);
    vi.unstubAllGlobals();
  });
});
