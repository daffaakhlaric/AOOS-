import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  OverviewSnapshotRepository,
  OverviewSnapshotRepositoryError,
} from "./overview-snapshot.repository.js";

function seedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "row-1",
    tenant_id: "dss-motor",
    snapshot_date: "2026-09-18",
    total_spend: 500_000,
    total_leads: 4,
    created_at: "2026-09-18T23:55:00.000Z",
    ...overrides,
  };
}

describe("OverviewSnapshotRepository", () => {
  describe("upsert", () => {
    it("inserts a new row for a previously-unswept tenant/date", async () => {
      const client = createFakeSupabaseClient();
      const repo = new OverviewSnapshotRepository(client);

      await repo.upsert("dss-motor", "2026-09-20", 1_000_000, 10);

      const rows = await repo.listRecent("dss-motor", 30);
      expect(rows).toEqual([{ date: "2026-09-20", totalSpend: 1_000_000, totalLeads: 10 }]);
    });

    it("is idempotent — re-running upsert for the same (tenant_id, snapshot_date) refreshes the row rather than duplicating it", async () => {
      const client = createFakeSupabaseClient();
      client.seed("overview_daily_snapshots", seedRow());
      const repo = new OverviewSnapshotRepository(client);

      await repo.upsert("dss-motor", "2026-09-18", 750_000, 6);

      expect(client.rows("overview_daily_snapshots")).toHaveLength(1);
      const rows = await repo.listRecent("dss-motor", 30);
      expect(rows).toEqual([{ date: "2026-09-18", totalSpend: 750_000, totalLeads: 6 }]);
    });

    it("throws OverviewSnapshotRepositoryError on a forced Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("overview_daily_snapshots", "boom");
      const repo = new OverviewSnapshotRepository(client);

      await expect(repo.upsert("dss-motor", "2026-09-20", 1_000_000, 10)).rejects.toThrow(
        OverviewSnapshotRepositoryError,
      );
    });
  });

  describe("listRecent", () => {
    it("returns every real row for the tenant within the window, ascending by date", async () => {
      const client = createFakeSupabaseClient();
      client.seed("overview_daily_snapshots", seedRow({ id: "r1", snapshot_date: "2026-09-19" }));
      client.seed("overview_daily_snapshots", seedRow({ id: "r2", snapshot_date: "2026-09-18" }));
      const repo = new OverviewSnapshotRepository(client);

      const rows = await repo.listRecent("dss-motor", 30);

      expect(rows.map((r) => r.date)).toEqual(["2026-09-18", "2026-09-19"]);
    });

    it("never returns another tenant's rows", async () => {
      const client = createFakeSupabaseClient();
      client.seed("overview_daily_snapshots", seedRow({ tenant_id: "other-tenant" }));
      const repo = new OverviewSnapshotRepository(client);

      const rows = await repo.listRecent("dss-motor", 30);

      expect(rows).toEqual([]);
    });

    it("returns an empty, honest array (never fabricated points) for a tenant the cron hasn't swept yet", async () => {
      const client = createFakeSupabaseClient();
      const repo = new OverviewSnapshotRepository(client);

      const rows = await repo.listRecent("dss-motor", 30);

      expect(rows).toEqual([]);
    });

    it("throws OverviewSnapshotRepositoryError on a forced Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("overview_daily_snapshots", "boom");
      const repo = new OverviewSnapshotRepository(client);

      await expect(repo.listRecent("dss-motor", 30)).rejects.toThrow(
        OverviewSnapshotRepositoryError,
      );
    });
  });
});
