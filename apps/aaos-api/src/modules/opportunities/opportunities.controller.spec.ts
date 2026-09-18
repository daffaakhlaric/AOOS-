import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { OpportunitiesResponseDto } from "./dto/opportunities-response.dto.js";
import { OpportunitiesController } from "./opportunities.controller.js";
import type { OpportunitiesService } from "./opportunities.service.js";

const TENANT = "propertyklik-demo";

const RESPONSE_SAMPLE: OpportunitiesResponseDto = {
  campaignId: "meta-cmp-1",
  opportunities: [
    {
      type: "SCALING_OPPORTUNITY",
      confidence: 0.9,
      description: "Campaign meta-cmp-1 menunjukkan sinyal performa positif yang kuat.",
      evidence: "Keputusan Samantha untuk campaign ini adalah SCALE dengan confidence 90%.",
    },
  ],
};

function buildFakeService(): OpportunitiesService {
  return { detect: vi.fn(async () => RESPONSE_SAMPLE) } as unknown as OpportunitiesService;
}

describe("OpportunitiesController", () => {
  it("detect() delegates to the service with tenant id and campaignId", async () => {
    const service = buildFakeService();
    const controller = new OpportunitiesController(service);
    const result = await controller.detect(TENANT, "meta-cmp-1");
    expect(service.detect).toHaveBeenCalledWith(TENANT, "meta-cmp-1");
    expect(result).toEqual(RESPONSE_SAMPLE);
  });
});
