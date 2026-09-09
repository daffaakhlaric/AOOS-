import type { Ad, AdAccount, AdMetrics as AdMetricsType, Campaign } from "@aos/meta-ads-connector";
import {
  AdAccountId,
  AdBuilder,
  AdMetrics,
  AdSetBuilder,
  CampaignBuilder,
  Spend,
} from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { buildSyncSnapshot } from "./build-sync-snapshot.js";

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
  if (!result.ok) {
    throw new Error(`unwrap failed: ${JSON.stringify(result.error)}`);
  }
  return result.value as T;
}

function metrics(overrides: Partial<Parameters<typeof AdMetrics.create>[0]> = {}): AdMetricsType {
  return unwrap(
    AdMetrics.create({
      spend: Spend.zero(),
      impressions: 0,
      reach: 0,
      clicks: 0,
      conversations: 0,
      d2: 0,
      d3: 0,
      d5: 0,
      leadForm: 0,
      ...overrides,
    }),
  );
}

/** Same "plain object satisfying the real shape" test technique `asset-rollup.spec.ts` already establishes for `AdAccount` (its class is not part of the public API). */
function wrapInAdAccount(campaigns: readonly Campaign[]): AdAccount {
  const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));
  return {
    id: adAccountId,
    name: "Test Ad Account",
    businessManagerId: "bm_1",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    campaigns,
    syncedAt: new Date("2026-01-02T00:00:00.000Z"),
  } as AdAccount;
}

function buildAd(metaId: string, overrides: Partial<AdMetricsType> = {}): Ad {
  return unwrap(
    new AdBuilder()
      .withMetaId(metaId)
      .withMetrics(metrics(overrides as Parameters<typeof AdMetrics.create>[0]))
      .build(),
  );
}

describe("buildSyncSnapshot", () => {
  it("emits one dimension row per campaign/adset/ad, and one insight row per level", () => {
    const ad1 = buildAd("ad-1", {
      spend: unwrap(Spend.create(100_000)),
      impressions: 1000,
      clicks: 20,
      reach: 500,
      d3: 3,
      d5: 1,
      leadForm: 1,
      conversations: 5,
    });
    const ad2 = buildAd("ad-2", {
      spend: unwrap(Spend.create(50_000)),
      impressions: 500,
      clicks: 10,
      reach: 250,
      d3: 1,
    });
    const adSet = unwrap(new AdSetBuilder().withMetaId("adset-1").withAds([ad1, ad2]).build());
    const campaign = unwrap(new CampaignBuilder().withMetaId("camp-1").withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const snapshot = buildSyncSnapshot(adAccount, "t-1", "2026-09-09");

    expect(snapshot.campaigns).toHaveLength(1);
    expect(snapshot.campaigns[0]).toMatchObject({ tenantId: "t-1", metaCampaignId: "camp-1" });

    expect(snapshot.adSets).toHaveLength(1);
    expect(snapshot.adSets[0]).toMatchObject({ metaCampaignId: "camp-1", metaAdSetId: "adset-1" });

    expect(snapshot.ads).toHaveLength(2);
    expect(snapshot.ads.map((a) => a.metaAdId).sort()).toEqual(["ad-1", "ad-2"]);

    // 2 ad-level + 1 adset-level + 1 campaign-level = 4 insight rows.
    expect(snapshot.insights).toHaveLength(4);

    const campaignInsight = snapshot.insights.find((row) => row.level === "campaign");
    expect(campaignInsight?.metrics.spend).toBe(150_000);
    expect(campaignInsight?.metrics.impressions).toBe(1500);
    expect(campaignInsight?.metrics.clicks).toBe(30);
    expect(campaignInsight?.metrics.leads).toBe(6); // (3+1+1) + (1+0+0)
    expect(campaignInsight?.date).toBe("2026-09-09");

    const adSetInsight = snapshot.insights.find((row) => row.level === "adset");
    expect(adSetInsight?.metrics.spend).toBe(150_000);

    const ad1Insight = snapshot.insights.find(
      (row) => row.level === "ad" && row.metaAdId === "ad-1",
    );
    expect(ad1Insight?.metrics.spend).toBe(100_000);
    expect(ad1Insight?.metrics.leads).toBe(5); // d3(3) + d5(1) + leadForm(1)
    expect(ad1Insight?.metrics.ctr).toBeCloseTo((20 / 1000) * 100);
    expect(ad1Insight?.metrics.cpm).toBeCloseTo((100_000 / 1000) * 1000);
    expect(ad1Insight?.metrics.messagingConversations).toBe(5);
  });

  it("never divides by zero — ctr/cpm/cpc/cpl are 0 for an ad with no impressions/clicks/leads", () => {
    const ad = buildAd("ad-zero");
    const adSet = unwrap(new AdSetBuilder().withMetaId("adset-1").withAds([ad]).build());
    const campaign = unwrap(new CampaignBuilder().withMetaId("camp-1").withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const snapshot = buildSyncSnapshot(adAccount, "t-1", "2026-09-09");
    const adInsight = snapshot.insights.find((row) => row.level === "ad");

    expect(adInsight?.metrics.ctr).toBe(0);
    expect(adInsight?.metrics.cpm).toBe(0);
    expect(adInsight?.metrics.cpc).toBe(0);
    expect(adInsight?.metrics.cpl).toBe(0);
    expect(adInsight?.metrics.frequency).toBe(0);
  });

  it("returns an empty snapshot for an ad account with zero campaigns", () => {
    const snapshot = buildSyncSnapshot(wrapInAdAccount([]), "t-1", "2026-09-09");
    expect(snapshot).toEqual({ campaigns: [], adSets: [], ads: [], insights: [] });
  });
});
