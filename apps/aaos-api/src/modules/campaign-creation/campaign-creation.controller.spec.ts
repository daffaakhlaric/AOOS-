import { describe, expect, it, vi } from "vitest";

import { CampaignCreationController } from "./campaign-creation.controller.js";
import type { CampaignCreationService } from "./campaign-creation.service.js";
import type {
  CampaignBlueprintResponseDto,
  CampaignPreflightResponseDto,
  ListingReadinessResponseDto,
} from "./dto/campaign-creation.dto.js";

const TENANT = "dss-motor";

const READINESS_SAMPLE: ListingReadinessResponseDto = {
  listingId: "listing-1",
  readiness: {
    listingId: "listing-1",
    ready: true,
    checks: [],
    blockingIssues: [],
    skippedChecks: [],
  },
};

function buildFakeService(): CampaignCreationService {
  return {
    getListingReadiness: vi.fn(async () => READINESS_SAMPLE),
    getBlueprint: vi.fn(async () => ({}) as CampaignBlueprintResponseDto),
    getPreflight: vi.fn(async () => ({}) as CampaignPreflightResponseDto),
  } as unknown as CampaignCreationService;
}

describe("CampaignCreationController", () => {
  it("listingReadiness() delegates to the service with the tenant id and listingId", async () => {
    const service = buildFakeService();
    const controller = new CampaignCreationController(service);
    const result = await controller.listingReadiness(TENANT, "listing-1");
    expect(service.getListingReadiness).toHaveBeenCalledWith(TENANT, "listing-1");
    expect(result).toBe(READINESS_SAMPLE);
  });

  it("blueprint() delegates to the service with the tenant id, growthObjectiveId, and listingId", async () => {
    const service = buildFakeService();
    const controller = new CampaignCreationController(service);
    await controller.blueprint(TENANT, "objective-1", "listing-1");
    expect(service.getBlueprint).toHaveBeenCalledWith(TENANT, "objective-1", "listing-1");
  });

  it("preflight() delegates to the service with the tenant id, growthObjectiveId, and listingId", async () => {
    const service = buildFakeService();
    const controller = new CampaignCreationController(service);
    await controller.preflight(TENANT, "objective-1", "listing-1");
    expect(service.getPreflight).toHaveBeenCalledWith(TENANT, "objective-1", "listing-1");
  });
});
