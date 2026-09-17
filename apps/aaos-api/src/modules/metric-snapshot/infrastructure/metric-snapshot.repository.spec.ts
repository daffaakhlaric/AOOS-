import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  MetricSnapshotRepository,
  MetricSnapshotRepositoryError,
} from "./metric-snapshot.repository.js";

const TENANT = "propertyklik-demo";
const META_CAMPAIGN_ID = "meta-cmp-123";
const CAMPAIGN_ROW_ID = "campaign-uuid-1";

function seedCampaign(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Record<string, unknown> = {},
) {
  client.seed("meta_campaigns", {
    id: CAMPAIGN_ROW_ID,
    tenant_id: TENANT,
    meta_campaign_id: META_CAMPAIGN_ID,
    ...overrides,
  });
}

function seedInsight(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Record<string, unknown> = {},
) {
  client.seed("meta_insights_daily", {
    tenant_id: TENANT,
    level: "campaign",
    campaign_id: CAMPAIGN_ROW_ID,
    date: "2026-01-15",
    spend: 100_000,
    impressions: 1_000,
    clicks: 20,
    reach: 900,
    leads: 2,
    ...overrides,
  });
}

describe("MetricSnapshotRepository", () => {
  describe("getCampaignInsightRows", () => {
    it("returns [] honestly when the campaign has never synced (no meta_campaigns row)", async () => {
      const client = createFakeSupabaseClient();
      const repo = new MetricSnapshotRepository(client);
      const rows = await repo.getCampaignInsightRows(TENANT, META_CAMPAIGN_ID, undefined);
      expect(rows).toEqual([]);
    });

    it("returns [] when the campaign exists but has no insight rows yet", async () => {
      const client = createFakeSupabaseClient();
      seedCampaign(client);
      const repo = new MetricSnapshotRepository(client);
      const rows = await repo.getCampaignInsightRows(TENANT, META_CAMPAIGN_ID, undefined);
      expect(rows).toEqual([]);
    });

    it("returns the campaign's insight rows for a lifetime (undefined) range — no date filter applied", async () => {
      const client = createFakeSupabaseClient();
      seedCampaign(client);
      seedInsight(client, { date: "2025-01-01" });
      seedInsight(client, { date: "2026-06-01" });
      const repo = new MetricSnapshotRepository(client);
      const rows = await repo.getCampaignInsightRows(TENANT, META_CAMPAIGN_ID, undefined);
      expect(rows).toHaveLength(2);
    });

    it("applies the date range filter (gte/lte) when one is given", async () => {
      const client = createFakeSupabaseClient();
      seedCampaign(client);
      seedInsight(client, { date: "2026-01-10" }); // outside range
      seedInsight(client, { date: "2026-01-15" }); // inside range
      seedInsight(client, { date: "2026-01-25" }); // outside range
      const repo = new MetricSnapshotRepository(client);
      const rows = await repo.getCampaignInsightRows(TENANT, META_CAMPAIGN_ID, {
        start: "2026-01-14",
        end: "2026-01-16",
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.date).toBe("2026-01-15");
    });

    it("is tenant-scoped — a campaign under a different tenant is never returned", async () => {
      const client = createFakeSupabaseClient();
      seedCampaign(client, { tenant_id: "other-tenant" });
      const repo = new MetricSnapshotRepository(client);
      const rows = await repo.getCampaignInsightRows(TENANT, META_CAMPAIGN_ID, undefined);
      expect(rows).toEqual([]);
    });

    it("only returns level='campaign' rows, never adset/ad-level rows for the same campaign_id", async () => {
      const client = createFakeSupabaseClient();
      seedCampaign(client);
      seedInsight(client, { level: "campaign", date: "2026-01-15" });
      seedInsight(client, { level: "adset", date: "2026-01-15" });
      const repo = new MetricSnapshotRepository(client);
      const rows = await repo.getCampaignInsightRows(TENANT, META_CAMPAIGN_ID, undefined);
      expect(rows).toHaveLength(1);
    });

    it("throws MetricSnapshotRepositoryError when the campaign lookup fails", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("meta_campaigns", "boom");
      const repo = new MetricSnapshotRepository(client);
      await expect(
        repo.getCampaignInsightRows(TENANT, META_CAMPAIGN_ID, undefined),
      ).rejects.toThrow(MetricSnapshotRepositoryError);
    });

    it("throws MetricSnapshotRepositoryError when the insights query fails", async () => {
      const client = createFakeSupabaseClient();
      seedCampaign(client);
      client.forceErrorOnce("meta_insights_daily", "boom");
      const repo = new MetricSnapshotRepository(client);
      await expect(
        repo.getCampaignInsightRows(TENANT, META_CAMPAIGN_ID, undefined),
      ).rejects.toThrow(MetricSnapshotRepositoryError);
    });
  });

  describe("getAccountInsightRows", () => {
    it("returns [] honestly when nothing has synced for the tenant", async () => {
      const client = createFakeSupabaseClient();
      const repo = new MetricSnapshotRepository(client);
      const rows = await repo.getAccountInsightRows(TENANT, undefined);
      expect(rows).toEqual([]);
    });

    it("returns rows across every campaign for the tenant, no campaign_id filter", async () => {
      const client = createFakeSupabaseClient();
      seedInsight(client, { campaign_id: "campaign-a", date: "2026-01-10" });
      seedInsight(client, { campaign_id: "campaign-b", date: "2026-01-11" });
      const repo = new MetricSnapshotRepository(client);
      const rows = await repo.getAccountInsightRows(TENANT, undefined);
      expect(rows).toHaveLength(2);
    });

    it("applies the date range filter when one is given", async () => {
      const client = createFakeSupabaseClient();
      seedInsight(client, { campaign_id: "campaign-a", date: "2026-01-05" });
      seedInsight(client, { campaign_id: "campaign-b", date: "2026-01-15" });
      const repo = new MetricSnapshotRepository(client);
      const rows = await repo.getAccountInsightRows(TENANT, {
        start: "2026-01-10",
        end: "2026-01-20",
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.date).toBe("2026-01-15");
    });

    it("is tenant-scoped — rows under a different tenant are never returned", async () => {
      const client = createFakeSupabaseClient();
      seedInsight(client, { tenant_id: "other-tenant" });
      const repo = new MetricSnapshotRepository(client);
      const rows = await repo.getAccountInsightRows(TENANT, undefined);
      expect(rows).toEqual([]);
    });

    it("only returns level='campaign' rows", async () => {
      const client = createFakeSupabaseClient();
      seedInsight(client, { level: "campaign", date: "2026-01-10" });
      seedInsight(client, { level: "ad", date: "2026-01-10" });
      const repo = new MetricSnapshotRepository(client);
      const rows = await repo.getAccountInsightRows(TENANT, undefined);
      expect(rows).toHaveLength(1);
    });

    it("throws MetricSnapshotRepositoryError when the query fails", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("meta_insights_daily", "boom");
      const repo = new MetricSnapshotRepository(client);
      await expect(repo.getAccountInsightRows(TENANT, undefined)).rejects.toThrow(
        MetricSnapshotRepositoryError,
      );
    });
  });
});
