import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { SyncSnapshot } from "../domain/build-sync-snapshot.js";

import { MetaSyncRepository, MetaSyncRepositoryError } from "./meta-sync.repository.js";

interface FakeRow {
  readonly id: string;
  [key: string]: unknown;
}

function makeFakeClient(rowsByTable: Record<string, FakeRow[]>) {
  const upsertCalls: Array<{ table: string; values: unknown; onConflict: string }> = [];
  const client = {
    from: vi.fn((table: string) => ({
      upsert: vi.fn(async (values: Record<string, unknown>[], options: { onConflict: string }) => {
        upsertCalls.push({ table, values, onConflict: options.onConflict });
        return { data: null, error: null };
      }),
      select: vi.fn(() => ({
        eq: vi.fn(async (_col: string, _val: string) => ({
          data: rowsByTable[table] ?? [],
          error: null,
        })),
      })),
    })),
  };
  return { client, upsertCalls };
}

const EMPTY_SNAPSHOT: SyncSnapshot = { campaigns: [], adSets: [], ads: [], insights: [] };

describe("MetaSyncRepository.upsertSnapshot", () => {
  it("is a no-op for a completely empty snapshot", async () => {
    const { client, upsertCalls } = makeFakeClient({});
    const repository = new MetaSyncRepository(client as never);

    await repository.upsertSnapshot(EMPTY_SNAPSHOT);

    expect(upsertCalls).toHaveLength(0);
  });

  it("upserts campaigns on the real (tenant_id, meta_campaign_id) conflict target", async () => {
    const { client, upsertCalls } = makeFakeClient({
      meta_campaigns: [{ id: "row-1", meta_campaign_id: "camp-1" }],
    });
    const repository = new MetaSyncRepository(client as never);

    const snapshot: SyncSnapshot = {
      ...EMPTY_SNAPSHOT,
      campaigns: [
        {
          tenantId: "t-1",
          metaCampaignId: "camp-1",
          name: "Campaign 1",
          status: "ACTIVE",
          objective: "OUTCOME_LEADS",
          spend: 1000,
          metaCreatedAt: null,
        },
      ],
    };

    await repository.upsertSnapshot(snapshot);

    const campaignUpsert = upsertCalls.find((call) => call.table === "meta_campaigns");
    expect(campaignUpsert).toBeDefined();
    expect(campaignUpsert?.onConflict).toBe("tenant_id,meta_campaign_id");
  });

  it("upserts insights on the real (tenant_id, level, entity_ref_id, date) conflict target", async () => {
    const { client, upsertCalls } = makeFakeClient({
      meta_campaigns: [{ id: "camp-row-1", meta_campaign_id: "camp-1" }],
    });
    const repository = new MetaSyncRepository(client as never);

    const snapshot: SyncSnapshot = {
      campaigns: [
        {
          tenantId: "t-1",
          metaCampaignId: "camp-1",
          name: "C1",
          status: "ACTIVE",
          objective: "OUTCOME_LEADS",
          spend: 0,
          metaCreatedAt: null,
        },
      ],
      adSets: [],
      ads: [],
      insights: [
        {
          tenantId: "t-1",
          level: "campaign",
          metaCampaignId: "camp-1",
          metaAdSetId: null,
          metaAdId: null,
          date: "2026-09-09",
          metrics: {
            spend: 0,
            impressions: 0,
            clicks: 0,
            reach: 0,
            frequency: 0,
            ctr: 0,
            cpm: 0,
            cpc: 0,
            cpl: 0,
            leads: 0,
            messagingConversations: 0,
            actions: { d2: 0, d3: 0, d5: 0, leadForm: 0 },
          },
        },
      ],
    };

    await repository.upsertSnapshot(snapshot);

    const insightsUpsert = upsertCalls.find((call) => call.table === "meta_insights_daily");
    expect(insightsUpsert).toBeDefined();
    expect(insightsUpsert?.onConflict).toBe("tenant_id,level,entity_ref_id,date");
    expect((insightsUpsert?.values as Array<{ campaign_id: string }>)[0]?.campaign_id).toBe(
      "camp-row-1",
    );
  });

  it("throws MetaSyncRepositoryError when the real upsert reports an error", async () => {
    const client = {
      from: vi.fn(() => ({
        upsert: vi.fn(async () => ({ data: null, error: { message: "db unavailable" } })),
        select: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [], error: null })) })),
      })),
    };
    const repository = new MetaSyncRepository(client as never);

    const snapshot: SyncSnapshot = {
      ...EMPTY_SNAPSHOT,
      campaigns: [
        {
          tenantId: "t-1",
          metaCampaignId: "camp-1",
          name: "C1",
          status: "ACTIVE",
          objective: "OUTCOME_LEADS",
          spend: 0,
          metaCreatedAt: null,
        },
      ],
    };

    await expect(repository.upsertSnapshot(snapshot)).rejects.toThrow(MetaSyncRepositoryError);
  });
});

// Campaign Page Rebuild v2 — real read-back of `meta_insights_daily` for one campaign's
// sparkline/trend display. Investigated directly before writing this: the table was already
// populated by `MetaSyncCronService`'s real 15-minute/daily sweeps (`050_meta_sync.sql`) but had
// no read path anywhere in this codebase — this is that real read path, not a new table.
describe("MetaSyncRepository.getCampaignDailyHistory", () => {
  /** A minimal chainable fake supporting the exact real `.select().eq().eq().maybeSingle()` (campaign lookup) and `.select().eq().eq().eq().gte().order()` (insights query) shapes this method uses. */
  function makeChainableFakeClient(config: {
    readonly campaignRow?: { readonly id: string; readonly meta_campaign_id: string } | null;
    readonly campaignError?: { readonly message: string };
    readonly insightRows?: readonly Record<string, unknown>[];
    readonly insightError?: { readonly message: string };
  }) {
    const eqCalls: Array<{ table: string; column: string; value: unknown }> = [];
    function chain(table: string): Record<string, unknown> {
      const self: Record<string, unknown> = {
        select: vi.fn(() => self),
        eq: vi.fn((column: string, value: unknown) => {
          eqCalls.push({ table, column, value });
          return self;
        }),
        gte: vi.fn(() => self),
        order: vi.fn(async () => ({
          data: config.insightRows ?? [],
          error: config.insightError ?? null,
        })),
        maybeSingle: vi.fn(async () => ({
          data: config.campaignRow ?? null,
          error: config.campaignError ?? null,
        })),
      };
      return self;
    }
    const client = { from: vi.fn((table: string) => chain(table)) };
    return { client, eqCalls };
  }

  it("returns an empty array (never fabricated) when this tenant/campaign has no real meta_campaigns row yet", async () => {
    const { client } = makeChainableFakeClient({ campaignRow: null });
    const repository = new MetaSyncRepository(client as never);

    const points = await repository.getCampaignDailyHistory("t-1", "camp-1", 7);

    expect(points).toEqual([]);
  });

  it("throws MetaSyncRepositoryError when the real campaign lookup reports an error", async () => {
    const { client } = makeChainableFakeClient({
      campaignError: { message: "db down" },
    });
    const repository = new MetaSyncRepository(client as never);

    await expect(repository.getCampaignDailyHistory("t-1", "camp-1", 7)).rejects.toThrow(
      MetaSyncRepositoryError,
    );
  });

  it("maps real meta_insights_daily rows (oldest-to-newest) to the camelCase CampaignDailyHistoryPoint shape", async () => {
    const { client, eqCalls } = makeChainableFakeClient({
      campaignRow: { id: "row-uuid-1", meta_campaign_id: "camp-1" },
      insightRows: [
        {
          date: "2026-09-10",
          spend: 100_000,
          impressions: 5000,
          clicks: 50,
          frequency: 1.2,
          ctr: 0.01,
          cpl: 50_000,
          leads: 2,
        },
      ],
    });
    const repository = new MetaSyncRepository(client as never);

    const points = await repository.getCampaignDailyHistory("t-1", "camp-1", 7);

    expect(points).toEqual([
      {
        date: "2026-09-10",
        spend: 100_000,
        impressions: 5000,
        clicks: 50,
        frequency: 1.2,
        ctr: 0.01,
        cpl: 50_000,
        leads: 2,
      },
    ]);
    // Real, tenant-scoped, campaign-level filter — never leaks another tenant's or another
    // campaign's/adset's/ad's rows.
    expect(eqCalls).toContainEqual({
      table: "meta_insights_daily",
      column: "campaign_id",
      value: "row-uuid-1",
    });
    expect(eqCalls).toContainEqual({
      table: "meta_insights_daily",
      column: "level",
      value: "campaign",
    });
  });

  it("throws MetaSyncRepositoryError when the real insights query reports an error", async () => {
    const { client } = makeChainableFakeClient({
      campaignRow: { id: "row-uuid-1", meta_campaign_id: "camp-1" },
      insightError: { message: "query timeout" },
    });
    const repository = new MetaSyncRepository(client as never);

    await expect(repository.getCampaignDailyHistory("t-1", "camp-1", 7)).rejects.toThrow(
      MetaSyncRepositoryError,
    );
  });
});

// Campaign->Listing Mapping (053_meta_campaigns_listing_id.sql) — real write path
// (`linkCampaignListing`, a plain UPDATE on the real (tenant_id, meta_campaign_id) row, never an
// upsert with guessed placeholder values) and read path (`getCampaignListingId`).
describe("MetaSyncRepository.linkCampaignListing", () => {
  function makeUpdateFakeClient(config: {
    readonly updatedRows?: readonly { readonly id: string }[];
    readonly error?: { readonly message: string };
  }) {
    const updateCalls: Array<{ table: string; values: unknown }> = [];
    const eqCalls: Array<{ column: string; value: unknown }> = [];
    function chain(table: string): Record<string, unknown> {
      const self: Record<string, unknown> = {
        update: vi.fn((values: Record<string, unknown>) => {
          updateCalls.push({ table, values });
          return self;
        }),
        eq: vi.fn((column: string, value: unknown) => {
          eqCalls.push({ column, value });
          return self;
        }),
        select: vi.fn(async () => ({
          data: config.updatedRows ?? [],
          error: config.error ?? null,
        })),
      };
      return self;
    }
    const client = { from: vi.fn((table: string) => chain(table)) };
    return { client, updateCalls, eqCalls };
  }

  it("returns true when the real UPDATE affects a real, already-synced meta_campaigns row", async () => {
    const { client, updateCalls, eqCalls } = makeUpdateFakeClient({
      updatedRows: [{ id: "row-uuid-1" }],
    });
    const repository = new MetaSyncRepository(client as never);

    const linked = await repository.linkCampaignListing("t-1", "camp-1", "listing-1");

    expect(linked).toBe(true);
    expect(updateCalls).toEqual([{ table: "meta_campaigns", values: { listing_id: "listing-1" } }]);
    expect(eqCalls).toContainEqual({ column: "tenant_id", value: "t-1" });
    expect(eqCalls).toContainEqual({ column: "meta_campaign_id", value: "camp-1" });
  });

  it("returns false (never fabricates a row) when the real sync hasn't created this campaign's row yet", async () => {
    const { client } = makeUpdateFakeClient({ updatedRows: [] });
    const repository = new MetaSyncRepository(client as never);

    const linked = await repository.linkCampaignListing("t-1", "camp-1", "listing-1");

    expect(linked).toBe(false);
  });

  it("throws MetaSyncRepositoryError when the real UPDATE reports an error", async () => {
    const { client } = makeUpdateFakeClient({ error: { message: "db down" } });
    const repository = new MetaSyncRepository(client as never);

    await expect(repository.linkCampaignListing("t-1", "camp-1", "listing-1")).rejects.toThrow(
      MetaSyncRepositoryError,
    );
  });
});

describe("MetaSyncRepository.getCampaignListingId", () => {
  function makeSelectFakeClient(config: {
    readonly row?: { readonly listing_id: string | null } | null;
    readonly error?: { readonly message: string };
  }) {
    function chain(): Record<string, unknown> {
      const self: Record<string, unknown> = {
        select: vi.fn(() => self),
        eq: vi.fn(() => self),
        maybeSingle: vi.fn(async () => ({ data: config.row ?? null, error: config.error ?? null })),
      };
      return self;
    }
    return { client: { from: vi.fn(() => chain()) } };
  }

  it("returns the real listing_id when this campaign has a real link", async () => {
    const { client } = makeSelectFakeClient({ row: { listing_id: "listing-1" } });
    const repository = new MetaSyncRepository(client as never);

    expect(await repository.getCampaignListingId("t-1", "camp-1")).toBe("listing-1");
  });

  it("returns null (never a fabricated id) when this campaign has no real link yet", async () => {
    const { client } = makeSelectFakeClient({ row: { listing_id: null } });
    const repository = new MetaSyncRepository(client as never);

    expect(await repository.getCampaignListingId("t-1", "camp-1")).toBeNull();
  });

  it("returns null when this tenant/campaign has no real meta_campaigns row at all", async () => {
    const { client } = makeSelectFakeClient({ row: null });
    const repository = new MetaSyncRepository(client as never);

    expect(await repository.getCampaignListingId("t-1", "camp-1")).toBeNull();
  });

  it("throws MetaSyncRepositoryError when the real lookup reports an error", async () => {
    const { client } = makeSelectFakeClient({ error: { message: "db down" } });
    const repository = new MetaSyncRepository(client as never);

    await expect(repository.getCampaignListingId("t-1", "camp-1")).rejects.toThrow(
      MetaSyncRepositoryError,
    );
  });
});
