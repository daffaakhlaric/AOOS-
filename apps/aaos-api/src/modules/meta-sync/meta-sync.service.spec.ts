import "reflect-metadata";

import { ok, err } from "@aos/common";
import { UnavailableError } from "@aos/errors";
import type { AdAccount } from "@aos/meta-ads-connector";
import { MetaApiError } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import type {
  MetaAdsConnectorContext,
  MetaAdsConnectorRegistry,
} from "../meta-ads/infrastructure/meta-ads-connector-registry.js";

import type { SyncSnapshot } from "./domain/build-sync-snapshot.js";
import type { MetaSyncRepository } from "./infrastructure/meta-sync.repository.js";
import { filterSnapshotToCampaign, MetaSyncService } from "./meta-sync.service.js";

function emptyAdAccount(): AdAccount {
  return { campaigns: [] } as unknown as AdAccount;
}

function buildConnector(pullResult: unknown): MetaAdsConnectorContext {
  return {
    accessToken: "token",
    adAccountIds: ["act_123"],
    pullCampaignData: { execute: vi.fn(async () => pullResult) },
  } as unknown as MetaAdsConnectorContext;
}

describe("MetaSyncService.syncCampaign", () => {
  it("never throws when the connector is not configured", async () => {
    const registry = {
      resolve: vi.fn(async () => err(new UnavailableError("no connector"))),
    } as unknown as MetaAdsConnectorRegistry;
    const repository = { upsertSnapshot: vi.fn() } as unknown as MetaSyncRepository;
    const service = new MetaSyncService(registry, repository);

    await expect(service.syncCampaign("t-1", "camp-1")).resolves.toBeUndefined();
    expect(repository.upsertSnapshot).not.toHaveBeenCalled();
  });

  it("never throws when the real Meta pull fails", async () => {
    const connector = buildConnector(err(new MetaApiError("rate limited")));
    const registry = {
      resolve: vi.fn(async () => ok(connector)),
    } as unknown as MetaAdsConnectorRegistry;
    const repository = { upsertSnapshot: vi.fn() } as unknown as MetaSyncRepository;
    const service = new MetaSyncService(registry, repository);

    await expect(service.syncCampaign("t-1", "camp-1")).resolves.toBeUndefined();
    expect(repository.upsertSnapshot).not.toHaveBeenCalled();
  });

  it("never throws on an unexpected error (e.g. a bad ad account id)", async () => {
    const registry = {
      resolve: vi.fn(async () => {
        throw new Error("boom");
      }),
    } as unknown as MetaAdsConnectorRegistry;
    const repository = { upsertSnapshot: vi.fn() } as unknown as MetaSyncRepository;
    const service = new MetaSyncService(registry, repository);

    await expect(service.syncCampaign("t-1", "camp-1")).resolves.toBeUndefined();
  });

  it("upserts only when the pull succeeds and the campaign is present", async () => {
    const connector = buildConnector(ok(emptyAdAccount()));
    const registry = {
      resolve: vi.fn(async () => ok(connector)),
    } as unknown as MetaAdsConnectorRegistry;
    const repository = {
      upsertSnapshot: vi.fn(async () => undefined),
    } as unknown as MetaSyncRepository;
    const service = new MetaSyncService(registry, repository);

    // Campaign not present in an empty pull — an honest no-op, not an error.
    await service.syncCampaign("t-1", "camp-1");
    expect(repository.upsertSnapshot).not.toHaveBeenCalled();
  });
});

describe("MetaSyncService.syncAllCampaignInsights / saveDailySnapshot", () => {
  it("is a no-op (never throws) when the tenant has no configured connector", async () => {
    const registry = {
      resolve: vi.fn(async () => err(new UnavailableError("no connector"))),
    } as unknown as MetaAdsConnectorRegistry;
    const repository = { upsertSnapshot: vi.fn() } as unknown as MetaSyncRepository;
    const service = new MetaSyncService(registry, repository);

    await expect(service.syncAllCampaignInsights("t-1")).resolves.toBeUndefined();
    await expect(service.saveDailySnapshot("t-1")).resolves.toBeUndefined();
    expect(repository.upsertSnapshot).not.toHaveBeenCalled();
  });

  it("throws (for the cron caller to catch) when the real Meta pull fails", async () => {
    const connector = buildConnector(err(new MetaApiError("boom")));
    const registry = {
      resolve: vi.fn(async () => ok(connector)),
    } as unknown as MetaAdsConnectorRegistry;
    const repository = { upsertSnapshot: vi.fn() } as unknown as MetaSyncRepository;
    const service = new MetaSyncService(registry, repository);

    await expect(service.syncAllCampaignInsights("t-1")).rejects.toThrow("boom");
    expect(repository.upsertSnapshot).not.toHaveBeenCalled();
  });

  it("persists a real snapshot on a successful pull", async () => {
    const connector = buildConnector(ok(emptyAdAccount()));
    const registry = {
      resolve: vi.fn(async () => ok(connector)),
    } as unknown as MetaAdsConnectorRegistry;
    const repository = {
      upsertSnapshot: vi.fn(async () => undefined),
    } as unknown as MetaSyncRepository;
    const service = new MetaSyncService(registry, repository);

    await service.syncAllCampaignInsights("t-1");
    expect(repository.upsertSnapshot).toHaveBeenCalledTimes(1);

    await service.saveDailySnapshot("t-1", new Date("2026-09-09T00:00:00.000Z"));
    expect(repository.upsertSnapshot).toHaveBeenCalledTimes(2);
  });

  it("saveDailySnapshot requests yesterday's date_preset, not today's", async () => {
    const connector = buildConnector(ok(emptyAdAccount()));
    const registry = {
      resolve: vi.fn(async () => ok(connector)),
    } as unknown as MetaAdsConnectorRegistry;
    const repository = {
      upsertSnapshot: vi.fn(async () => undefined),
    } as unknown as MetaSyncRepository;
    const service = new MetaSyncService(registry, repository);

    await service.saveDailySnapshot("t-1", new Date("2026-09-09T00:00:00.000Z"));

    expect(connector.pullCampaignData.execute).toHaveBeenCalledWith(
      expect.objectContaining({ datePreset: "yesterday" }),
    );
  });
});

describe("filterSnapshotToCampaign", () => {
  const snapshot: SyncSnapshot = {
    campaigns: [
      {
        tenantId: "t-1",
        metaCampaignId: "camp-1",
        name: "A",
        status: "ACTIVE",
        objective: "OUTCOME_LEADS",
        spend: 0,
        metaCreatedAt: null,
      },
      {
        tenantId: "t-1",
        metaCampaignId: "camp-2",
        name: "B",
        status: "ACTIVE",
        objective: "OUTCOME_LEADS",
        spend: 0,
        metaCreatedAt: null,
      },
    ],
    adSets: [
      {
        tenantId: "t-1",
        metaCampaignId: "camp-1",
        metaAdSetId: "adset-1",
        name: "AS1",
        status: "ACTIVE",
        dailyBudget: 0,
        spend: 0,
        audienceLabel: null,
      },
      {
        tenantId: "t-1",
        metaCampaignId: "camp-2",
        metaAdSetId: "adset-2",
        name: "AS2",
        status: "ACTIVE",
        dailyBudget: 0,
        spend: 0,
        audienceLabel: null,
      },
    ],
    ads: [
      {
        tenantId: "t-1",
        metaAdSetId: "adset-1",
        metaAdId: "ad-1",
        name: "Ad1",
        status: "ACTIVE",
        stableId: "#C001",
        creativeKind: null,
        creativeRef: null,
        verdict: "HOLD",
      },
      {
        tenantId: "t-1",
        metaAdSetId: "adset-2",
        metaAdId: "ad-2",
        name: "Ad2",
        status: "ACTIVE",
        stableId: "#C002",
        creativeKind: null,
        creativeRef: null,
        verdict: "HOLD",
      },
    ],
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
      {
        tenantId: "t-1",
        level: "campaign",
        metaCampaignId: "camp-2",
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

  it("keeps only the target campaign's rows across every table", () => {
    const filtered = filterSnapshotToCampaign(snapshot, "camp-1");

    expect(filtered.campaigns.map((c) => c.metaCampaignId)).toEqual(["camp-1"]);
    expect(filtered.adSets.map((a) => a.metaAdSetId)).toEqual(["adset-1"]);
    expect(filtered.ads.map((a) => a.metaAdId)).toEqual(["ad-1"]);
    expect(filtered.insights.map((i) => i.metaCampaignId)).toEqual(["camp-1"]);
  });

  it("returns an empty snapshot for an unknown campaign id", () => {
    const filtered = filterSnapshotToCampaign(snapshot, "camp-unknown");
    expect(filtered.campaigns).toHaveLength(0);
    expect(filtered.adSets).toHaveLength(0);
    expect(filtered.ads).toHaveLength(0);
    expect(filtered.insights).toHaveLength(0);
  });
});
