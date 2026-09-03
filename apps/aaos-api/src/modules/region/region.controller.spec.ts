import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { RegionController } from "./region.controller.js";
import type { RegionService } from "./region.service.js";

function buildFakeService(): RegionService {
  return {
    getProvinces: vi.fn(async () => [{ id: "11", nama: "Aceh" }]),
    getRegencies: vi.fn(async () => [{ id: "1101", nama: "Kabupaten Aceh Selatan" }]),
    getDistricts: vi.fn(async () => [{ id: "110101", nama: "Bakongan" }]),
  } as unknown as RegionService;
}

describe("RegionController", () => {
  it("GET provinces delegates to RegionService.getProvinces, wrapped in {items}", async () => {
    const service = buildFakeService();
    const controller = new RegionController(service);
    expect(await controller.provinces()).toEqual({ items: [{ id: "11", nama: "Aceh" }] });
  });

  it("GET regencies/:provinceId delegates to RegionService.getRegencies with the real param", async () => {
    const service = buildFakeService();
    const controller = new RegionController(service);
    const result = await controller.regencies("11");
    expect(service.getRegencies).toHaveBeenCalledWith("11");
    expect(result).toEqual({ items: [{ id: "1101", nama: "Kabupaten Aceh Selatan" }] });
  });

  it("GET districts/:regencyId delegates to RegionService.getDistricts with the real param", async () => {
    const service = buildFakeService();
    const controller = new RegionController(service);
    const result = await controller.districts("1101");
    expect(service.getDistricts).toHaveBeenCalledWith("1101");
    expect(result).toEqual({ items: [{ id: "110101", nama: "Bakongan" }] });
  });

  it("is guarded by ApiKeyGuard — public reference data, but still behind this app's real auth perimeter", () => {
    const guards = Reflect.getMetadata("__guards__", RegionController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });

  it("is mounted at api/v1/region", () => {
    expect(Reflect.getMetadata("path", RegionController)).toBe("api/v1/region");
  });
});
