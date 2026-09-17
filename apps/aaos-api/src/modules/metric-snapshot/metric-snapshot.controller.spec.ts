import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { MetricSnapshotDto } from "./dto/metric-snapshot.dto.js";
import { MetricSnapshotController } from "./metric-snapshot.controller.js";
import type { MetricSnapshotService } from "./metric-snapshot.service.js";

const TENANT = "propertyklik-demo";

const SNAPSHOT_SAMPLE: MetricSnapshotDto = {
  window: "last_7_days",
  spend: 100_000,
  impressions: 1_000,
  clicks: 20,
  reach: 900,
  leads: 2,
  ctr: 0.02,
  cpm: 100_000,
  cpc: 5_000,
  cpl: 50_000,
  frequency: 1.11,
  sampleSize: { impressions: 1_000, clicks: 20, leads: 2 },
  daysCovered: 1,
  dataSufficiency: { level: "INSUFFICIENT", score: 10, reasons: ["not enough data"] },
};

function buildFakeService(): MetricSnapshotService {
  return {
    getCampaignSnapshot: vi.fn(async () => SNAPSHOT_SAMPLE),
    getAccountSnapshot: vi.fn(async () => SNAPSHOT_SAMPLE),
  } as unknown as MetricSnapshotService;
}

describe("MetricSnapshotController", () => {
  it("campaign() delegates to the service with tenant id, campaignId, and the validated window", async () => {
    const service = buildFakeService();
    const controller = new MetricSnapshotController(service);
    const result = await controller.campaign(TENANT, "meta-cmp-1", { window: "last_7_days" });
    expect(service.getCampaignSnapshot).toHaveBeenCalledWith(TENANT, "meta-cmp-1", "last_7_days");
    expect(result.campaignId).toBe("meta-cmp-1");
    expect(result.spend).toBe(100_000);
  });

  it("account() delegates to the service with tenant id and the validated window", async () => {
    const service = buildFakeService();
    const controller = new MetricSnapshotController(service);
    const result = await controller.account(TENANT, { window: "lifetime" });
    expect(service.getAccountSnapshot).toHaveBeenCalledWith(TENANT, "lifetime");
    expect(result.spend).toBe(100_000);
  });
});
