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

import { generateHeatmapInsight, getAudienceCreativeHeatmap } from "./heatmap-rollup.js";

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

/** Same "plain object satisfying the real shape" test technique `asset-rollup.spec.ts` already establishes. */
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

describe("getAudienceCreativeHeatmap", () => {
  it("groups ads sharing the same (asset, audienceLabel) pair into one cell, summing additive metrics", () => {
    const ad1 = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(100_000)), impressions: 1000, clicks: 10, leadForm: 2 }),
    );
    const ad2 = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(50_000)), impressions: 500, clicks: 5, leadForm: 1 }),
    );
    const adSet = unwrap(
      new AdSetBuilder().withAds([ad1, ad2]).withAudienceLabel("INTEREST").build(),
    );
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const heatmap = getAudienceCreativeHeatmap(adAccount, NOW);

    expect(heatmap.cells).toHaveLength(1);
    expect(heatmap.cells[0]).toMatchObject({
      assetKind: "IMAGE",
      assetId: "hash-A",
      audienceLabel: "INTEREST",
      adCount: 2,
      spend: 150_000,
      impressions: 1500,
      clicks: 15,
    });
    expect(heatmap.untaggedAdCount).toBe(0);
    expect(heatmap.adAccountId).toBe("act_752604553578354");
    expect(heatmap.generatedAt).toBe(NOW.toISOString());
  });

  it("keeps the same creative asset in separate cells when its parent ad sets have different audienceLabels", () => {
    const ad1 = adWithAsset({ kind: "IMAGE", imageHash: "hash-A" }, metrics());
    const ad2 = adWithAsset({ kind: "IMAGE", imageHash: "hash-A" }, metrics());
    const adSetBroad = unwrap(new AdSetBuilder().withAds([ad1]).withAudienceLabel("BROAD").build());
    const adSetLookalike = unwrap(
      new AdSetBuilder().withAds([ad2]).withAudienceLabel("LOOKALIKE_1").build(),
    );
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSetBroad, adSetLookalike]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const heatmap = getAudienceCreativeHeatmap(adAccount, NOW);

    expect(heatmap.cells).toHaveLength(2);
    expect(heatmap.cells.map((c) => c.audienceLabel).sort()).toEqual(["BROAD", "LOOKALIKE_1"]);
    // Same underlying asset id appears in both rows of the grid.
    expect(heatmap.cells.every((c) => c.assetId === "hash-A")).toBe(true);
    expect(heatmap.creativeAssetIds).toEqual(["hash-A"]);
  });

  it("counts ads with no creativeAsset as untagged, excluded from cells[]", () => {
    const tagged = adWithAsset({ kind: "IMAGE", imageHash: "hash-A" }, metrics());
    const untagged = adWithAsset(undefined, metrics());
    const adSet = unwrap(
      new AdSetBuilder().withAds([tagged, untagged]).withAudienceLabel("BROAD").build(),
    );
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const heatmap = getAudienceCreativeHeatmap(adAccount, NOW);

    expect(heatmap.cells).toHaveLength(1);
    expect(heatmap.untaggedAdCount).toBe(1);
  });

  it("counts ads whose parent AdSet carries no audienceLabel at all as untagged (real, honest safety net)", () => {
    const ad = adWithAsset({ kind: "IMAGE", imageHash: "hash-A" }, metrics());
    // No .withAudienceLabel(...) call — AdSetBuilder leaves it undefined by default.
    const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const heatmap = getAudienceCreativeHeatmap(adAccount, NOW);

    expect(heatmap.cells).toHaveLength(0);
    expect(heatmap.untaggedAdCount).toBe(1);
  });

  it("reports maxFrequency (non-additive) per cell", () => {
    const ad1 = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ impressions: 400, reach: 100 }), // frequency 4.0
    );
    const ad2 = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ impressions: 100, reach: 100 }), // frequency 1.0
    );
    const adSet = unwrap(new AdSetBuilder().withAds([ad1, ad2]).withAudienceLabel("BROAD").build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const heatmap = getAudienceCreativeHeatmap(adAccount, NOW);

    expect(heatmap.cells[0]?.maxFrequency).toBe(4);
  });

  it("computes ctr/cpm/cpl from the cell's own summed spend/impressions/clicks/totalLead, division-safe", () => {
    const ad = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({
        spend: unwrap(Spend.create(200_000)),
        impressions: 1000,
        clicks: 50,
        leadForm: 2,
      }),
    );
    const adSet = unwrap(new AdSetBuilder().withAds([ad]).withAudienceLabel("BROAD").build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const heatmap = getAudienceCreativeHeatmap(adAccount, NOW);
    const cell = heatmap.cells[0];
    expect(cell).toBeDefined();
    if (cell !== undefined) {
      expect(cell.ctr).toBe(50 / 1000);
      expect(cell.cpm).toBe((200_000 / 1000) * 1000);
      expect(cell.cpl).toBe(cell.totalLead > 0 ? cell.spend / cell.totalLead : null);
    }
  });

  it("returns null ctr/cpm when impressions is 0 (division-safe, never Infinity/NaN)", () => {
    const ad = adWithAsset({ kind: "IMAGE", imageHash: "hash-A" }, metrics());
    const adSet = unwrap(new AdSetBuilder().withAds([ad]).withAudienceLabel("BROAD").build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const heatmap = getAudienceCreativeHeatmap(adAccount, NOW);

    expect(heatmap.cells[0]?.ctr).toBeNull();
    expect(heatmap.cells[0]?.cpm).toBeNull();
  });

  it("orders creativeAssetIds by total spend descending across all audience rows for that asset", () => {
    const lowAd = adWithAsset(
      { kind: "IMAGE", imageHash: "low-spend" },
      metrics({ spend: unwrap(Spend.create(10_000)) }),
    );
    const highAd1 = adWithAsset(
      { kind: "IMAGE", imageHash: "high-spend" },
      metrics({ spend: unwrap(Spend.create(300_000)) }),
    );
    const highAd2 = adWithAsset(
      { kind: "IMAGE", imageHash: "high-spend" },
      metrics({ spend: unwrap(Spend.create(300_000)) }),
    );
    const adSetLow = unwrap(new AdSetBuilder().withAds([lowAd]).withAudienceLabel("BROAD").build());
    const adSetHigh1 = unwrap(
      new AdSetBuilder().withAds([highAd1]).withAudienceLabel("BROAD").build(),
    );
    const adSetHigh2 = unwrap(
      new AdSetBuilder().withAds([highAd2]).withAudienceLabel("INTEREST").build(),
    );
    const campaign = unwrap(
      new CampaignBuilder().withAdSets([adSetLow, adSetHigh1, adSetHigh2]).build(),
    );
    const adAccount = wrapInAdAccount([campaign]);

    const heatmap = getAudienceCreativeHeatmap(adAccount, NOW);

    expect(heatmap.creativeAssetIds).toEqual(["high-spend", "low-spend"]);
  });

  it("orders audienceLabels by classifyAudience's own real bucket-priority order, only including labels actually present", () => {
    const adRetargeting = adWithAsset({ kind: "IMAGE", imageHash: "a" }, metrics());
    const adBroad = adWithAsset({ kind: "IMAGE", imageHash: "b" }, metrics());
    const adSetRetargeting = unwrap(
      new AdSetBuilder().withAds([adRetargeting]).withAudienceLabel("RETARGETING").build(),
    );
    const adSetBroad = unwrap(
      new AdSetBuilder().withAds([adBroad]).withAudienceLabel("BROAD").build(),
    );
    const campaign = unwrap(
      new CampaignBuilder().withAdSets([adSetRetargeting, adSetBroad]).build(),
    );
    const adAccount = wrapInAdAccount([campaign]);

    const heatmap = getAudienceCreativeHeatmap(adAccount, NOW);

    // BROAD sorts before RETARGETING per AUDIENCE_LABEL_ORDER, regardless of ad-set insertion order.
    expect(heatmap.audienceLabels).toEqual(["BROAD", "RETARGETING"]);
    // LOOKALIKE_1/INTEREST/CUSTOM_CRM never appeared, so they're absent, not padded in as empty rows.
    expect(heatmap.audienceLabels).not.toContain("LOOKALIKE_1");
  });

  it("returns an empty grid (not an error) for an AdAccount with no ads", () => {
    const adSet = unwrap(new AdSetBuilder().withAds([]).withAudienceLabel("BROAD").build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const heatmap = getAudienceCreativeHeatmap(adAccount, NOW);

    expect(heatmap.cells).toEqual([]);
    expect(heatmap.creativeAssetIds).toEqual([]);
    expect(heatmap.audienceLabels).toEqual([]);
    expect(heatmap.benchmarkCplIDR).toBeNull();
  });

  it("computes benchmarkCplIDR as the arithmetic mean of each real ad's own rphLead (Phase 1's own client-side convention, restated server-side)", () => {
    const ad1 = adWithAsset(
      { kind: "IMAGE", imageHash: "a" },
      metrics({ spend: unwrap(Spend.create(100_000)), leadForm: 1 }), // rphLead 100_000
    );
    const ad2 = adWithAsset(
      { kind: "IMAGE", imageHash: "b" },
      metrics({ spend: unwrap(Spend.create(300_000)), leadForm: 1 }), // rphLead 300_000
    );
    const adSet = unwrap(new AdSetBuilder().withAds([ad1, ad2]).withAudienceLabel("BROAD").build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const heatmap = getAudienceCreativeHeatmap(adAccount, NOW);

    expect(heatmap.benchmarkCplIDR).toBe((100_000 + 300_000) / 2);
  });
});

describe("generateHeatmapInsight", () => {
  it("reports an honest 'not enough data' message when no cell has any lead", () => {
    const text = generateHeatmapInsight(
      [
        {
          assetKind: "IMAGE",
          assetId: "a",
          audienceLabel: "BROAD",
          adCount: 1,
          spend: 100_000,
          impressions: 100,
          clicks: 1,
          totalLead: 0,
          maxFrequency: 1,
          ctr: 0.01,
          cpm: 1_000,
          cpl: null,
        },
      ],
      null,
    );
    expect(text).toMatch(/Belum ada cukup data/);
  });

  it("names the lowest-CPL cell as the best-performing combination", () => {
    const text = generateHeatmapInsight(
      [
        {
          assetKind: "IMAGE",
          assetId: "cheap",
          audienceLabel: "BROAD",
          adCount: 1,
          spend: 100_000,
          impressions: 1000,
          clicks: 10,
          totalLead: 10,
          maxFrequency: 1,
          ctr: 0.01,
          cpm: 100,
          cpl: 10_000,
        },
        {
          assetKind: "IMAGE",
          assetId: "expensive",
          audienceLabel: "INTEREST",
          adCount: 1,
          spend: 1_000_000,
          impressions: 1000,
          clicks: 10,
          totalLead: 1,
          maxFrequency: 1,
          ctr: 0.01,
          cpm: 1_000,
          cpl: 1_000_000,
        },
      ],
      null,
    );
    expect(text).toContain("cheap");
    expect(text).toContain("BROAD");
  });

  it("flags a cell exceeding 1.5x the benchmark CPL as an outlier to review", () => {
    const text = generateHeatmapInsight(
      [
        {
          assetKind: "IMAGE",
          assetId: "normal",
          audienceLabel: "BROAD",
          adCount: 1,
          spend: 100_000,
          impressions: 1000,
          clicks: 10,
          totalLead: 10,
          maxFrequency: 1,
          ctr: 0.01,
          cpm: 100,
          cpl: 10_000,
        },
        {
          assetKind: "IMAGE",
          assetId: "outlier",
          audienceLabel: "RETARGETING",
          adCount: 1,
          spend: 200_000,
          impressions: 1000,
          clicks: 10,
          totalLead: 1,
          maxFrequency: 1,
          ctr: 0.01,
          cpm: 200,
          cpl: 200_000,
        },
      ],
      10_000,
    );
    expect(text).toContain("outlier");
    expect(text).toContain("RETARGETING");
  });
});
