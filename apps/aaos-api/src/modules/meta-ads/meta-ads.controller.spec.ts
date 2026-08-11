import "reflect-metadata";

import type { ExecutionResult } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import type { AdAccountResponseDto } from "./dto/campaign-response.dto.js";
import { ApiKeyGuard } from "./guards/api-key.guard.js";
import { MetaAdsController } from "./meta-ads.controller.js";
import type { MetaAdsService } from "./meta-ads.service.js";

function buildFakeService(): MetaAdsService {
  return {
    pullCampaigns: vi.fn(async () => ({ id: "act_1" }) as AdAccountResponseDto),
    executeVerdict: vi.fn(
      async () => ({ action: "PAUSED", targetId: "id", targetType: "ad" }) as ExecutionResult,
    ),
  } as unknown as MetaAdsService;
}

describe("MetaAdsController", () => {
  it("GET /api/v1/campaigns delegates to MetaAdsService.pullCampaigns with the query + correlation id", async () => {
    const service = buildFakeService();
    const controller = new MetaAdsController(service);
    const result = await controller.getCampaigns(
      { adAccountId: "act_1", datePreset: "last_30d" },
      "corr-1",
    );
    expect(service.pullCampaigns).toHaveBeenCalledWith(
      { adAccountId: "act_1", datePreset: "last_30d" },
      "corr-1",
    );
    expect(result).toEqual({ id: "act_1" });
  });

  it("POST /api/v1/verdicts delegates to MetaAdsService.executeVerdict with the body + correlation id", async () => {
    const service = buildFakeService();
    const controller = new MetaAdsController(service);
    const body = { verdict: "PAUSE" as const, targetId: "id", targetType: "ad" as const };
    const result = await controller.postVerdict(body, "corr-2");
    expect(service.executeVerdict).toHaveBeenCalledWith(body, "corr-2");
    expect(result).toEqual({ action: "PAUSED", targetId: "id", targetType: "ad" });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", MetaAdsController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});
