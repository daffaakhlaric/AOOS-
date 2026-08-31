import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CampaignsController } from "./campaigns.controller.js";
import type { CampaignsService } from "./campaigns.service.js";
import type { CreateCampaignResponseDto } from "./dto/create-campaign.dto.js";

function buildFakeService(): CampaignsService {
  return {
    createCampaign: vi.fn(
      async () =>
        ({ campaignId: "c-1", adSetId: "as-1", simulated: false }) as CreateCampaignResponseDto,
    ),
  } as unknown as CampaignsService;
}

describe("CampaignsController (AAOS-W1D-S3)", () => {
  it("POST /api/v1/campaigns/create delegates to CampaignsService.createCampaign with the body + correlation id", async () => {
    const service = buildFakeService();
    const controller = new CampaignsController(service);
    const body = {
      adAccountId: "act_752604553578354",
      name: "Meta-CTWA-Leads-Mobix-Cinere",
      branch: "CINERE" as const,
      funnel: "CTWA" as const,
    };
    const result = await controller.createCampaign(body, "corr-1");
    expect(service.createCampaign).toHaveBeenCalledWith(body, "corr-1");
    expect(result).toEqual({ campaignId: "c-1", adSetId: "as-1", simulated: false });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", CampaignsController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });

  it("is routed at the api/v1/campaigns base path", () => {
    const path = Reflect.getMetadata("path", CampaignsController) as string;
    expect(path).toBe("api/v1/campaigns");
  });

  it("createCampaign returns the exact { campaignId, adSetId } shape the service resolves", async () => {
    const service = buildFakeService();
    const controller = new CampaignsController(service);
    const result = await controller.createCampaign(
      { adAccountId: "act_1", name: "X", branch: "CINERE" as const, funnel: "CTWA" as const },
      "corr-2",
    );
    expect(Object.keys(result).sort()).toEqual(["adSetId", "campaignId", "simulated"]);
  });
});
