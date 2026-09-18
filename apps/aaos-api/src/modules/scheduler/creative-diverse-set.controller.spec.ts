import { describe, expect, it, vi } from "vitest";

import { CreativeDiverseSetController } from "./creative-diverse-set.controller.js";
import type { SchedulerService } from "./scheduler.service.js";

describe("CreativeDiverseSetController", () => {
  it("POST diverse-set delegates straight to SchedulerService.createDiverseCreativeBriefSet with the real tenant id + body fields", async () => {
    const createDiverseCreativeBriefSet = vi.fn(async () => ({
      requestedCount: 5,
      allowedCount: 5,
      cappedByDailyLimit: false,
      createdCount: 2,
      packages: [],
    }));
    const schedulerService = {
      createDiverseCreativeBriefSet,
    } as unknown as SchedulerService;
    const controller = new CreativeDiverseSetController(schedulerService);

    const result = await controller.createDiverseSet("dss-motor", {
      listingId: "listing-1",
      campaignId: "campaign-1",
      requestedCount: 5,
    });

    expect(createDiverseCreativeBriefSet).toHaveBeenCalledWith(
      "dss-motor",
      "listing-1",
      5,
      "campaign-1",
      undefined,
    );
    expect(result.createdCount).toBe(2);
  });

  // EYVRA — SAMANTHA V2 + KAI V2 Phase 23 — real optional samanthaContext must reach
  // `SchedulerService.createDiverseCreativeBriefSet`'s own 5th param unchanged.
  it("threads a real samanthaContext through to SchedulerService.createDiverseCreativeBriefSet when the body includes it", async () => {
    const createDiverseCreativeBriefSet = vi.fn(async () => ({
      requestedCount: 5,
      allowedCount: 5,
      cappedByDailyLimit: false,
      createdCount: 2,
      packages: [],
    }));
    const schedulerService = {
      createDiverseCreativeBriefSet,
    } as unknown as SchedulerService;
    const controller = new CreativeDiverseSetController(schedulerService);
    const samanthaContext = {
      rootCause: "CREATIVE_FATIGUE",
      impact: "HIGH",
      contributingFactors: ["Frequency sudah 5.2 — creative kemungkinan sudah jenuh."],
      decisionReason: "Root cause CREATIVE_FATIGUE terdeteksi.",
    };

    await controller.createDiverseSet("dss-motor", {
      listingId: "listing-1",
      campaignId: "campaign-1",
      requestedCount: 5,
      samanthaContext,
    });

    expect(createDiverseCreativeBriefSet).toHaveBeenCalledWith(
      "dss-motor",
      "listing-1",
      5,
      "campaign-1",
      samanthaContext,
    );
  });
});
