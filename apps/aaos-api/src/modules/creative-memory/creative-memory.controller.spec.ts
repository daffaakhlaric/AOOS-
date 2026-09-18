import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { CreativeMemoryController } from "./creative-memory.controller.js";
import type { CreativeMemoryService } from "./creative-memory.service.js";
import type { AnglePerformanceResponseDto } from "./dto/angle-performance.dto.js";
import type { AssetPerformanceResponseDto } from "./dto/asset-performance.dto.js";

const TENANT = "propertyklik-demo";

const RESPONSE_SAMPLE: AnglePerformanceResponseDto = {
  angles: [
    {
      angle: "URGENCY",
      packageCount: 1,
      aggregated: { spend: 100_000, impressions: 1_000, clicks: 20, reach: 900, leads: 2 },
      dataSufficiency: { level: "INSUFFICIENT", score: 10, reasons: ["not enough data"] },
      rank: undefined,
    },
  ],
};

const ASSET_RESPONSE_SAMPLE: AssetPerformanceResponseDto = {
  assets: [
    {
      packageId: "pkg-1",
      angle: "URGENCY",
      title: "Rumah Minimalis BSD",
      fatigueStatus: "NORMAL",
      hasVideo: false,
      imageCount: 3,
      aggregated: { spend: 100_000, impressions: 1_000, clicks: 20, reach: 900, leads: 2 },
      dataSufficiency: { level: "INSUFFICIENT", score: 10, reasons: ["not enough data"] },
      rank: undefined,
    },
  ],
};

function buildFakeService(): CreativeMemoryService {
  return {
    getAnglePerformance: vi.fn(async () => RESPONSE_SAMPLE),
    getAssetPerformance: vi.fn(async () => ASSET_RESPONSE_SAMPLE),
  } as unknown as CreativeMemoryService;
}

describe("CreativeMemoryController", () => {
  it("anglePerformance() delegates to the service with the tenant id and no window when since/until are omitted", async () => {
    const service = buildFakeService();
    const controller = new CreativeMemoryController(service);
    const result = await controller.anglePerformance(TENANT, {});
    expect(service.getAnglePerformance).toHaveBeenCalledWith(TENANT, undefined);
    expect(result).toEqual(RESPONSE_SAMPLE);
  });

  it("builds a WindowDateRange from since/until when both are given", async () => {
    const service = buildFakeService();
    const controller = new CreativeMemoryController(service);
    await controller.anglePerformance(TENANT, { since: "2026-01-01", until: "2026-01-31" });
    expect(service.getAnglePerformance).toHaveBeenCalledWith(TENANT, {
      start: "2026-01-01",
      end: "2026-01-31",
    });
  });

  it("assetPerformance() delegates to the service with the tenant id and no window when since/until are omitted", async () => {
    const service = buildFakeService();
    const controller = new CreativeMemoryController(service);
    const result = await controller.assetPerformance(TENANT, {});
    expect(service.getAssetPerformance).toHaveBeenCalledWith(TENANT, undefined);
    expect(result).toEqual(ASSET_RESPONSE_SAMPLE);
  });

  it("assetPerformance() builds a WindowDateRange from since/until when both are given", async () => {
    const service = buildFakeService();
    const controller = new CreativeMemoryController(service);
    await controller.assetPerformance(TENANT, { since: "2026-01-01", until: "2026-01-31" });
    expect(service.getAssetPerformance).toHaveBeenCalledWith(TENANT, {
      start: "2026-01-01",
      end: "2026-01-31",
    });
  });
});
