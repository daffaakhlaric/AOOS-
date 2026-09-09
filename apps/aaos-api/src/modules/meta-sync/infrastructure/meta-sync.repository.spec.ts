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
