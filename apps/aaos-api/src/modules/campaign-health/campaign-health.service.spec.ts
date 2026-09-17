import { describe, expect, it, vi } from "vitest";

import type { MetricSnapshotDto } from "../metric-snapshot/dto/metric-snapshot.dto.js";
import type { MetricSnapshotService } from "../metric-snapshot/metric-snapshot.service.js";

import { CampaignHealthService } from "./campaign-health.service.js";

const TENANT = "propertyklik-demo";
const META_CAMPAIGN_ID = "meta-cmp-1";

function makeSnapshot(overrides: Partial<MetricSnapshotDto> = {}): MetricSnapshotDto {
  return {
    window: "last_7_days",
    spend: 1_000_000,
    impressions: 25_000,
    clicks: 500,
    reach: 20_000,
    leads: 20,
    ctr: 0.02,
    cpm: 40_000,
    cpc: 2_000,
    cpl: 50_000,
    frequency: 1.25,
    sampleSize: { impressions: 25_000, clicks: 500, leads: 20 },
    daysCovered: 7,
    dataSufficiency: { level: "HIGH", score: 100, reasons: [] },
    ...overrides,
  };
}

interface FakeSnapshots {
  current?: Partial<MetricSnapshotDto>;
  previous?: Partial<MetricSnapshotDto>;
  campaignLifetime?: Partial<MetricSnapshotDto>;
  accountLifetime?: Partial<MetricSnapshotDto>;
}

function buildFakeMetricSnapshotService(snapshots: FakeSnapshots = {}): MetricSnapshotService {
  const current = makeSnapshot(snapshots.current);
  const previous = makeSnapshot({ ctr: 0.02, cpl: 50_000, frequency: 1.25, ...snapshots.previous });
  const campaignLifetime = makeSnapshot({
    window: "lifetime",
    dataSufficiency: { level: "HIGH", score: 100, reasons: [] },
    ...snapshots.campaignLifetime,
  });
  const accountLifetime = makeSnapshot({
    window: "lifetime",
    dataSufficiency: { level: "HIGH", score: 100, reasons: [] },
    ...snapshots.accountLifetime,
  });

  return {
    getCampaignSnapshot: vi.fn(async (_tenantId: string, _campaignId: string, window: string) => {
      if (window === "last_7_days") return current;
      if (window === "previous_7_days") return previous;
      return campaignLifetime; // "lifetime"
    }),
    getAccountSnapshot: vi.fn(async () => accountLifetime),
  } as unknown as MetricSnapshotService;
}

describe("CampaignHealthService", () => {
  it("assess() fetches 4 real snapshots (current, previous, campaign lifetime, account lifetime)", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService();
    const service = new CampaignHealthService(metricSnapshotService);
    await service.assess(TENANT, META_CAMPAIGN_ID);

    expect(metricSnapshotService.getCampaignSnapshot).toHaveBeenCalledWith(
      TENANT,
      META_CAMPAIGN_ID,
      "last_7_days",
    );
    expect(metricSnapshotService.getCampaignSnapshot).toHaveBeenCalledWith(
      TENANT,
      META_CAMPAIGN_ID,
      "previous_7_days",
    );
    expect(metricSnapshotService.getCampaignSnapshot).toHaveBeenCalledWith(
      TENANT,
      META_CAMPAIGN_ID,
      "lifetime",
    );
    expect(metricSnapshotService.getAccountSnapshot).toHaveBeenCalledWith(TENANT, "lifetime");
  });

  it("returns a CampaignHealthResponseDto echoing the real campaignId with health + diagnosis", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService();
    const service = new CampaignHealthService(metricSnapshotService);
    const result = await service.assess(TENANT, META_CAMPAIGN_ID);

    expect(result.campaignId).toBe(META_CAMPAIGN_ID);
    expect(result.health.overallStatus).toBeDefined();
    expect(result.diagnosis).toBeDefined();
    expect(result.decision).toBeDefined();
  });

  it("a healthy, stable campaign against a HIGH-confidence benchmark reports HEALTHY overallStatus", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService();
    const service = new CampaignHealthService(metricSnapshotService);
    const result = await service.assess(TENANT, META_CAMPAIGN_ID);

    expect(result.health.overallStatus).toBe("HEALTHY");
    expect(result.health.costEfficiency.status).toBe("HEALTHY");
    expect(result.health.audience.status).toBe("UNKNOWN");
    expect(result.health.tracking.status).toBe("UNKNOWN");
    expect(result.health.leadQuality.status).toBe("UNKNOWN");
    expect(result.decision.decision).toBe("NO_ACTION");
  });

  it("a real CPL spike vs. a usable benchmark surfaces as CRITICAL overallStatus with a rootCause", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService({
      current: { cpl: 60_000, spend: 1_000_000, leads: 20 },
      previous: { cpl: 50_000 },
      campaignLifetime: { cpl: 50_000 },
    });
    const service = new CampaignHealthService(metricSnapshotService);
    const result = await service.assess(TENANT, META_CAMPAIGN_ID);

    expect(result.diagnosis.rootCause).toBe("CPL_SPIKE");
    expect(result.diagnosis.confidence).toBeGreaterThan(0);
    expect(result.decision.decision).toBe("REVIEW");
    expect(result.decision.primaryDiagnosis).toBe("CPL_SPIKE");
  });

  it("computes ctrTrendForFatigue only when the previous window has real coverage", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService({
      previous: { daysCovered: 0, ctr: undefined },
    });
    const service = new CampaignHealthService(metricSnapshotService);
    // Should not throw despite an empty previous window, and creative should still be assessable
    // from real frequency data (frequencyDataAvailable derives from current.frequency, not the
    // ctrTrend).
    const result = await service.assess(TENANT, META_CAMPAIGN_ID);
    expect(result.health.creative.status).not.toBe("UNKNOWN");
  });

  it("marks creative UNKNOWN when the current snapshot has no real frequency value", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService({
      current: { frequency: undefined },
    });
    const service = new CampaignHealthService(metricSnapshotService);
    const result = await service.assess(TENANT, META_CAMPAIGN_ID);
    expect(result.health.creative.status).toBe("UNKNOWN");
  });

  it("marks costEfficiency UNKNOWN when neither historical source is usable (benchmark NONE)", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService({
      campaignLifetime: { dataSufficiency: { level: "LOW", score: 20, reasons: ["low"] } },
      accountLifetime: { dataSufficiency: { level: "LOW", score: 20, reasons: ["low"] } },
    });
    const service = new CampaignHealthService(metricSnapshotService);
    const result = await service.assess(TENANT, META_CAMPAIGN_ID);
    expect(result.health.costEfficiency.status).toBe("UNKNOWN");
  });
});
