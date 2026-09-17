import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  CreativeMemoryRepository,
  CreativeMemoryRepositoryError,
} from "./creative-memory.repository.js";

const TENANT = "propertyklik-demo";

function seedPackage(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Record<string, unknown> = {},
) {
  client.seed("creative_packages", {
    id: "pkg-1",
    tenant_id: TENANT,
    vertical: "PROPERTY",
    angle: "URGENCY",
    published_meta_ad_ids: ["meta-ad-1"],
    fatigue_status: "NORMAL",
    generated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

function seedAd(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Record<string, unknown> = {},
) {
  client.seed("meta_ads", {
    id: "ad-uuid-1",
    tenant_id: TENANT,
    meta_ad_id: "meta-ad-1",
    ...overrides,
  });
}

function seedInsight(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Record<string, unknown> = {},
) {
  client.seed("meta_insights_daily", {
    tenant_id: TENANT,
    level: "ad",
    ad_id: "ad-uuid-1",
    date: "2026-01-15",
    spend: 100_000,
    impressions: 1_000,
    clicks: 20,
    reach: 900,
    leads: 2,
    ...overrides,
  });
}

describe("CreativeMemoryRepository", () => {
  describe("listPublishedPropertyPackages", () => {
    it("returns [] honestly when nothing has been published for the tenant", async () => {
      const client = createFakeSupabaseClient();
      const repo = new CreativeMemoryRepository(client);
      expect(await repo.listPublishedPropertyPackages(TENANT)).toEqual([]);
    });

    it("returns a published PROPERTY package, mapped to camelCase", async () => {
      const client = createFakeSupabaseClient();
      seedPackage(client);
      const repo = new CreativeMemoryRepository(client);
      const rows = await repo.listPublishedPropertyPackages(TENANT);
      expect(rows).toEqual([
        {
          id: "pkg-1",
          angle: "URGENCY",
          publishedMetaAdIds: ["meta-ad-1"],
          fatigueStatus: "NORMAL",
          generatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]);
    });

    it("excludes a package whose published_meta_ad_ids is null (never published)", async () => {
      const client = createFakeSupabaseClient();
      seedPackage(client, { published_meta_ad_ids: null });
      const repo = new CreativeMemoryRepository(client);
      expect(await repo.listPublishedPropertyPackages(TENANT)).toEqual([]);
    });

    it("excludes a package whose published_meta_ad_ids is an empty array (attempted, all failed)", async () => {
      const client = createFakeSupabaseClient();
      seedPackage(client, { published_meta_ad_ids: [] });
      const repo = new CreativeMemoryRepository(client);
      expect(await repo.listPublishedPropertyPackages(TENANT)).toEqual([]);
    });

    it("excludes a non-PROPERTY (AUTOMOTIVE) package", async () => {
      const client = createFakeSupabaseClient();
      seedPackage(client, { vertical: "AUTOMOTIVE" });
      const repo = new CreativeMemoryRepository(client);
      expect(await repo.listPublishedPropertyPackages(TENANT)).toEqual([]);
    });

    it("is tenant-scoped — a package under a different tenant is never returned", async () => {
      const client = createFakeSupabaseClient();
      seedPackage(client, { tenant_id: "other-tenant" });
      const repo = new CreativeMemoryRepository(client);
      expect(await repo.listPublishedPropertyPackages(TENANT)).toEqual([]);
    });

    it("throws CreativeMemoryRepositoryError when the query fails", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("creative_packages", "boom");
      const repo = new CreativeMemoryRepository(client);
      await expect(repo.listPublishedPropertyPackages(TENANT)).rejects.toThrow(
        CreativeMemoryRepositoryError,
      );
    });
  });

  describe("getAdInsightRows", () => {
    it("returns [] honestly when the given meta_ad_id has never synced into meta_ads", async () => {
      const client = createFakeSupabaseClient();
      const repo = new CreativeMemoryRepository(client);
      expect(await repo.getAdInsightRows(TENANT, ["meta-ad-1"])).toEqual([]);
    });

    it("resolves the internal ad id then returns its real insight rows for a lifetime (no dateRange) query", async () => {
      const client = createFakeSupabaseClient();
      seedAd(client);
      seedInsight(client, { date: "2025-01-01" });
      seedInsight(client, { date: "2026-06-01" });
      const repo = new CreativeMemoryRepository(client);
      const rows = await repo.getAdInsightRows(TENANT, ["meta-ad-1"]);
      expect(rows).toHaveLength(2);
    });

    it("applies the date range filter (gte/lte) when one is given", async () => {
      const client = createFakeSupabaseClient();
      seedAd(client);
      seedInsight(client, { date: "2026-01-10" }); // outside range
      seedInsight(client, { date: "2026-01-15" }); // inside range
      seedInsight(client, { date: "2026-01-25" }); // outside range
      const repo = new CreativeMemoryRepository(client);
      const rows = await repo.getAdInsightRows(TENANT, ["meta-ad-1"], {
        start: "2026-01-14",
        end: "2026-01-16",
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.date).toBe("2026-01-15");
    });

    it("loops across multiple meta_ad_ids and flattens every resolved ad's rows into one array", async () => {
      const client = createFakeSupabaseClient();
      seedAd(client, { id: "ad-uuid-1", meta_ad_id: "meta-ad-1" });
      seedAd(client, { id: "ad-uuid-2", meta_ad_id: "meta-ad-2" });
      seedInsight(client, { ad_id: "ad-uuid-1", date: "2026-01-10" });
      seedInsight(client, { ad_id: "ad-uuid-2", date: "2026-01-11" });
      const repo = new CreativeMemoryRepository(client);
      const rows = await repo.getAdInsightRows(TENANT, ["meta-ad-1", "meta-ad-2"]);
      expect(rows).toHaveLength(2);
    });

    it("skips a meta_ad_id that never synced while still returning rows for the ones that did", async () => {
      const client = createFakeSupabaseClient();
      seedAd(client, { id: "ad-uuid-1", meta_ad_id: "meta-ad-1" });
      seedInsight(client, { ad_id: "ad-uuid-1", date: "2026-01-10" });
      const repo = new CreativeMemoryRepository(client);
      const rows = await repo.getAdInsightRows(TENANT, ["meta-ad-1", "meta-ad-never-synced"]);
      expect(rows).toHaveLength(1);
    });

    it("is tenant-scoped — an ad under a different tenant is never resolved", async () => {
      const client = createFakeSupabaseClient();
      seedAd(client, { tenant_id: "other-tenant" });
      const repo = new CreativeMemoryRepository(client);
      expect(await repo.getAdInsightRows(TENANT, ["meta-ad-1"])).toEqual([]);
    });

    it("only returns level='ad' rows for the resolved ad", async () => {
      const client = createFakeSupabaseClient();
      seedAd(client);
      seedInsight(client, { level: "ad", date: "2026-01-10" });
      seedInsight(client, { level: "campaign", date: "2026-01-10" });
      const repo = new CreativeMemoryRepository(client);
      const rows = await repo.getAdInsightRows(TENANT, ["meta-ad-1"]);
      expect(rows).toHaveLength(1);
    });

    it("throws CreativeMemoryRepositoryError when the ad lookup fails", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("meta_ads", "boom");
      const repo = new CreativeMemoryRepository(client);
      await expect(repo.getAdInsightRows(TENANT, ["meta-ad-1"])).rejects.toThrow(
        CreativeMemoryRepositoryError,
      );
    });

    it("throws CreativeMemoryRepositoryError when the insights query fails", async () => {
      const client = createFakeSupabaseClient();
      seedAd(client);
      client.forceErrorOnce("meta_insights_daily", "boom");
      const repo = new CreativeMemoryRepository(client);
      await expect(repo.getAdInsightRows(TENANT, ["meta-ad-1"])).rejects.toThrow(
        CreativeMemoryRepositoryError,
      );
    });
  });
});
