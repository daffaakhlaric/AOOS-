import type { Ad, AdAccount, AdMetrics, Campaign, CreativeAsset } from "@aos/meta-ads-connector";
import {
  AdAccountId,
  AdBuilder,
  AdMetrics as AdMetricsClass,
  AdSetBuilder,
  CampaignBuilder,
  Spend,
} from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { getAssetRollup } from "./asset-rollup.js";

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
  if (!result.ok) {
    throw new Error(`unwrap failed: ${JSON.stringify(result.error)}`);
  }
  return result.value as T;
}

function metrics(overrides: Partial<Parameters<typeof AdMetricsClass.create>[0]> = {}): AdMetrics {
  return unwrap(
    AdMetricsClass.create({
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

/** Same "plain object satisfying the real shape" test technique `campaign-response.dto.spec.ts` already establishes for `AdAccount` (its class is not part of the public API). */
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

function adWithAsset(creativeAsset: CreativeAsset | undefined, adMetrics: AdMetrics): Ad {
  return unwrap(new AdBuilder().withCreativeAsset(creativeAsset).withMetrics(adMetrics).build());
}

const NOW = new Date("2026-08-31T00:00:00.000Z");

describe("getAssetRollup", () => {
  it("groups ads sharing the same image_hash into one bucket, summing additive metrics", () => {
    const ad1 = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(100_000)), impressions: 1000, clicks: 10, d5: 2 }),
    );
    const ad2 = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(50_000)), impressions: 500, clicks: 5, d5: 1 }),
    );
    const adSet = unwrap(new AdSetBuilder().withAds([ad1, ad2]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const rollup = getAssetRollup(adAccount, NOW);

    expect(rollup.assets).toHaveLength(1);
    expect(rollup.assets[0]).toMatchObject({
      assetKind: "IMAGE",
      assetId: "hash-A",
      adCount: 2,
      spend: 150_000,
      impressions: 1500,
      clicks: 15,
    });
    expect(rollup.untaggedAdCount).toBe(0);
    expect(rollup.adAccountId).toBe("act_752604553578354");
    expect(rollup.generatedAt).toBe(NOW.toISOString());
  });

  it("keeps IMAGE and VIDEO assets in separate buckets even if the ids happened to collide as strings", () => {
    const ad1 = adWithAsset({ kind: "IMAGE", imageHash: "same-id" }, metrics());
    const ad2 = adWithAsset({ kind: "VIDEO", videoId: "same-id" }, metrics());
    const adSet = unwrap(new AdSetBuilder().withAds([ad1, ad2]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const rollup = getAssetRollup(adAccount, NOW);

    expect(rollup.assets).toHaveLength(2);
    expect(rollup.assets.map((a) => a.assetKind).sort()).toEqual(["IMAGE", "VIDEO"]);
  });

  it("counts ads with no creativeAsset as untagged, excluded from assets[]", () => {
    const tagged = adWithAsset({ kind: "IMAGE", imageHash: "hash-A" }, metrics());
    const untagged = adWithAsset(undefined, metrics());
    const adSet = unwrap(new AdSetBuilder().withAds([tagged, untagged]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const rollup = getAssetRollup(adAccount, NOW);

    expect(rollup.assets).toHaveLength(1);
    expect(rollup.untaggedAdCount).toBe(1);
  });

  it("reports maxFrequency (non-additive) rather than a summed/averaged frequency", () => {
    const ad1 = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ impressions: 400, reach: 100 }), // frequency 4.0
    );
    const ad2 = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ impressions: 100, reach: 100 }), // frequency 1.0
    );
    const adSet = unwrap(new AdSetBuilder().withAds([ad1, ad2]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const rollup = getAssetRollup(adAccount, NOW);

    expect(rollup.assets[0]?.maxFrequency).toBe(4);
  });

  it("recomputes rphLead from the bucket's own summed spend/totalLead, never summing per-ad rphLead", () => {
    const ad1 = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(100_000)), leadForm: 2 }),
    );
    const ad2 = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(100_000)), leadForm: 2 }),
    );
    const adSet = unwrap(new AdSetBuilder().withAds([ad1, ad2]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const rollup = getAssetRollup(adAccount, NOW);

    // totalLead sums leadForm+d5 depending on AdMetrics' own real totalLead definition; regardless
    // of that exact composition, rphLead must equal spend/totalLead recomputed at the bucket level.
    const asset = rollup.assets[0];
    expect(asset).toBeDefined();
    if (asset !== undefined) {
      expect(asset.spend).toBe(200_000);
      const expectedRph = asset.totalLead > 0 ? asset.spend / asset.totalLead : null;
      expect(asset.rphLead).toBe(expectedRph);
    }
  });

  it("returns rphLead: null when a bucket has 0 totalLead (division-safe, never Infinity/NaN)", () => {
    const ad = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(100_000)) }),
    );
    const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const rollup = getAssetRollup(adAccount, NOW);

    expect(rollup.assets[0]?.totalLead).toBe(0);
    expect(rollup.assets[0]?.rphLead).toBeNull();
  });

  it("sorts assets by spend descending", () => {
    const low = adWithAsset(
      { kind: "IMAGE", imageHash: "low-spend" },
      metrics({ spend: unwrap(Spend.create(10_000)) }),
    );
    const high = adWithAsset(
      { kind: "IMAGE", imageHash: "high-spend" },
      metrics({ spend: unwrap(Spend.create(500_000)) }),
    );
    const adSet = unwrap(new AdSetBuilder().withAds([low, high]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const rollup = getAssetRollup(adAccount, NOW);

    expect(rollup.assets.map((a) => a.assetId)).toEqual(["high-spend", "low-spend"]);
  });

  it("aggregates across multiple campaigns/ad sets, not just within one ad set", () => {
    const adA = adWithAsset(
      { kind: "IMAGE", imageHash: "shared-hash" },
      metrics({ spend: unwrap(Spend.create(10_000)) }),
    );
    const adB = adWithAsset(
      { kind: "IMAGE", imageHash: "shared-hash" },
      metrics({ spend: unwrap(Spend.create(20_000)) }),
    );
    const adSet1 = unwrap(new AdSetBuilder().withAds([adA]).build());
    const adSet2 = unwrap(new AdSetBuilder().withAds([adB]).build());
    const campaign1 = unwrap(new CampaignBuilder().withAdSets([adSet1]).build());
    const campaign2 = unwrap(new CampaignBuilder().withAdSets([adSet2]).build());
    const adAccount = wrapInAdAccount([campaign1, campaign2]);

    const rollup = getAssetRollup(adAccount, NOW);

    expect(rollup.assets).toHaveLength(1);
    expect(rollup.assets[0]?.adCount).toBe(2);
    expect(rollup.assets[0]?.spend).toBe(30_000);
  });

  it("returns an empty assets array (not an error) for an AdAccount with no ads", () => {
    const adSet = unwrap(new AdSetBuilder().withAds([]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const rollup = getAssetRollup(adAccount, NOW);

    expect(rollup.assets).toEqual([]);
    expect(rollup.untaggedAdCount).toBe(0);
  });
});
