import { describe, expect, it, vi } from "vitest";

import type {
  InsightRow,
  MetricSnapshotRepository,
} from "./infrastructure/metric-snapshot.repository.js";
import { MetricSnapshotService } from "./metric-snapshot.service.js";

const TENANT = "propertyklik-demo";
const META_CAMPAIGN_ID = "meta-cmp-1";

function row(overrides: Partial<InsightRow> = {}): InsightRow {
  return {
    date: "2026-01-15",
    spend: 100_000,
    impressions: 1_000,
    clicks: 20,
    reach: 900,
    leads: 2,
    ...overrides,
  };
}

function buildFakeRepository(
  campaignRows: readonly InsightRow[] = [],
  accountRows: readonly InsightRow[] = [],
): MetricSnapshotRepository {
  return {
    getCampaignInsightRows: vi.fn(async () => campaignRows),
    getAccountInsightRows: vi.fn(async () => accountRows),
  } as unknown as MetricSnapshotRepository;
}

describe("MetricSnapshotService", () => {
  describe("getCampaignSnapshot", () => {
    it("resolves the window into a date range and passes it to the repository", async () => {
      const repository = buildFakeRepository();
      const service = new MetricSnapshotService(repository);
      await service.getCampaignSnapshot(TENANT, META_CAMPAIGN_ID, "last_7_days");
      expect(repository.getCampaignInsightRows).toHaveBeenCalledWith(
        TENANT,
        META_CAMPAIGN_ID,
        expect.objectContaining({ start: expect.any(String), end: expect.any(String) }),
      );
    });

    it("passes undefined for a lifetime window — no date range", async () => {
      const repository = buildFakeRepository();
      const service = new MetricSnapshotService(repository);
      await service.getCampaignSnapshot(TENANT, META_CAMPAIGN_ID, "lifetime");
      expect(repository.getCampaignInsightRows).toHaveBeenCalledWith(
        TENANT,
        META_CAMPAIGN_ID,
        undefined,
      );
    });

    it("aggregates the rows and reports the real window key", async () => {
      const repository = buildFakeRepository([
        row({
          date: "2026-01-14",
          spend: 50_000,
          impressions: 500,
          clicks: 10,
          reach: 400,
          leads: 1,
        }),
        row({
          date: "2026-01-15",
          spend: 50_000,
          impressions: 500,
          clicks: 10,
          reach: 500,
          leads: 1,
        }),
      ]);
      const service = new MetricSnapshotService(repository);
      const snapshot = await service.getCampaignSnapshot(TENANT, META_CAMPAIGN_ID, "last_7_days");
      expect(snapshot.window).toBe("last_7_days");
      expect(snapshot.spend).toBe(100_000);
      expect(snapshot.impressions).toBe(1_000);
      expect(snapshot.leads).toBe(2);
      expect(snapshot.cpl).toBeCloseTo(50_000, 10);
    });

    it("reports daysCovered as the count of DISTINCT dates actually present, never the window's nominal length", async () => {
      const repository = buildFakeRepository([row({ date: "2026-01-15" })]);
      const service = new MetricSnapshotService(repository);
      const snapshot = await service.getCampaignSnapshot(TENANT, META_CAMPAIGN_ID, "last_7_days");
      expect(snapshot.daysCovered).toBe(1);
    });

    it("de-duplicates daysCovered when multiple rows somehow share a date", async () => {
      const repository = buildFakeRepository([
        row({ date: "2026-01-15" }),
        row({ date: "2026-01-15" }),
      ]);
      const service = new MetricSnapshotService(repository);
      const snapshot = await service.getCampaignSnapshot(TENANT, META_CAMPAIGN_ID, "last_7_days");
      expect(snapshot.daysCovered).toBe(1);
    });

    it("reports sampleSize mirroring the aggregated impressions/clicks/leads", async () => {
      const repository = buildFakeRepository([row({ impressions: 1_234, clicks: 56, leads: 7 })]);
      const service = new MetricSnapshotService(repository);
      const snapshot = await service.getCampaignSnapshot(TENANT, META_CAMPAIGN_ID, "last_7_days");
      expect(snapshot.sampleSize).toEqual({ impressions: 1_234, clicks: 56, leads: 7 });
    });

    it("includes a real dataSufficiency assessment", async () => {
      const repository = buildFakeRepository([]);
      const service = new MetricSnapshotService(repository);
      const snapshot = await service.getCampaignSnapshot(TENANT, META_CAMPAIGN_ID, "last_7_days");
      expect(snapshot.dataSufficiency.level).toBe("INSUFFICIENT");
    });

    it("returns an honest zeroed snapshot when the campaign has never synced (empty rows)", async () => {
      const repository = buildFakeRepository([]);
      const service = new MetricSnapshotService(repository);
      const snapshot = await service.getCampaignSnapshot(TENANT, META_CAMPAIGN_ID, "last_7_days");
      expect(snapshot.spend).toBe(0);
      expect(snapshot.cpl).toBeUndefined();
      expect(snapshot.daysCovered).toBe(0);
    });
  });

  describe("getAccountSnapshot", () => {
    it("delegates to the account-wide repository method with the resolved date range", async () => {
      const repository = buildFakeRepository([], [row()]);
      const service = new MetricSnapshotService(repository);
      await service.getAccountSnapshot(TENANT, "last_30_days");
      expect(repository.getAccountInsightRows).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ start: expect.any(String), end: expect.any(String) }),
      );
    });

    it("aggregates account rows the same way as campaign rows", async () => {
      const repository = buildFakeRepository([], [row({ spend: 200_000, leads: 4 })]);
      const service = new MetricSnapshotService(repository);
      const snapshot = await service.getAccountSnapshot(TENANT, "lifetime");
      expect(snapshot.spend).toBe(200_000);
      expect(snapshot.cpl).toBeCloseTo(50_000, 10);
    });
  });
});
