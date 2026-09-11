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
    );
    expect(result.createdCount).toBe(2);
  });
});
