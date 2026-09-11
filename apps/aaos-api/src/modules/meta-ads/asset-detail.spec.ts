import type { Ad, AdAccount, AdMetrics, Campaign, CreativeAsset } from "@aos/meta-ads-connector";
import {
  AdAccountId,
  AdBuilder,
  AdMetrics as AdMetricsClass,
  AdSetBuilder,
  Branch,
  CampaignBuilder,
  Spend,
} from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { getAssetDetail } from "./asset-detail.js";

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

function adWithAsset(
  creativeAsset: CreativeAsset | undefined,
  adMetrics: AdMetrics,
  overrides: { readonly name?: string; readonly metaId?: string; readonly branch?: Branch } = {},
): Ad {
  return unwrap(
    new AdBuilder()
      .withCreativeAsset(creativeAsset)
      .withMetrics(adMetrics)
      .withName(overrides.name ?? "Iklan Test")
      .withMetaId(overrides.metaId ?? "meta-1")
      .withBranch(overrides.branch ?? Branch.CINERE)
      .build(),
  );
}

const NOW = new Date("2026-08-31T00:00:00.000Z");
const UNAVAILABLE_INSIGHT = {
  available: false as const,
  reason: "NO_API_KEY" as const,
  message: "test",
};

describe("getAssetDetail", () => {
  it("returns undefined when no real ad in the pull carries this asset id", () => {
    const ad = adWithAsset({ kind: "IMAGE", imageHash: "other-hash" }, metrics());
    const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    expect(getAssetDetail(adAccount, "hash-A", NOW, UNAVAILABLE_INSIGHT)).toBeUndefined();
  });

  it("builds one copyVariants row per real ad sharing this asset, using the ad's own real name", () => {
    const ad1 = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(100_000)), leadForm: 1 }),
      { name: "Ad Variant 1", metaId: "meta-1" },
    );
    const ad2 = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(50_000)), leadForm: 1 }),
      { name: "Ad Variant 2", metaId: "meta-2" },
    );
    const adSet = unwrap(new AdSetBuilder().withAds([ad1, ad2]).withAudienceLabel("BROAD").build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const detail = getAssetDetail(adAccount, "hash-A", NOW, UNAVAILABLE_INSIGHT);

    expect(detail).toBeDefined();
    expect(detail?.copyVariants).toHaveLength(2);
    expect(detail?.copyVariants.map((v) => v.name).sort()).toEqual([
      "Ad Variant 1",
      "Ad Variant 2",
    ]);
    // Sorted by spend descending, same "most-consequential-first" convention every other rollup uses.
    expect(detail?.copyVariants[0]?.name).toBe("Ad Variant 1");
    expect(detail?.adCount).toBe(2);
    expect(detail?.spend).toBe(150_000);
  });

  it("groups this asset's own ads by real AdSet.audienceLabel into audienceBreakdown", () => {
    const adBroad = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(100_000)), leadForm: 2 }),
    );
    const adRetargeting = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(300_000)), leadForm: 1 }),
    );
    const adSetBroad = unwrap(
      new AdSetBuilder().withAds([adBroad]).withAudienceLabel("BROAD").build(),
    );
    const adSetRetargeting = unwrap(
      new AdSetBuilder().withAds([adRetargeting]).withAudienceLabel("RETARGETING").build(),
    );
    const campaign = unwrap(
      new CampaignBuilder().withAdSets([adSetBroad, adSetRetargeting]).build(),
    );
    const adAccount = wrapInAdAccount([campaign]);

    const detail = getAssetDetail(adAccount, "hash-A", NOW, UNAVAILABLE_INSIGHT);

    expect(detail?.audienceBreakdown).toHaveLength(2);
    // Ordered per classifyAudience's own bucket-priority order (BROAD before RETARGETING).
    expect(detail?.audienceBreakdown.map((b) => b.audienceLabel)).toEqual(["BROAD", "RETARGETING"]);
    const broadRow = detail?.audienceBreakdown.find((b) => b.audienceLabel === "BROAD");
    expect(broadRow?.spend).toBe(100_000);
    expect(broadRow?.cpl).toBe(100_000 / (broadRow?.totalLead ?? 1));
  });

  it("picks the lowest-CPL audience with a real lead as topAudienceLabel", () => {
    const cheap = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(10_000)), leadForm: 1 }), // cpl 10,000
    );
    const expensive = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(1_000_000)), leadForm: 1 }), // cpl 1,000,000
    );
    const adSetCheap = unwrap(
      new AdSetBuilder().withAds([cheap]).withAudienceLabel("BROAD").build(),
    );
    const adSetExpensive = unwrap(
      new AdSetBuilder().withAds([expensive]).withAudienceLabel("INTEREST").build(),
    );
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSetCheap, adSetExpensive]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const detail = getAssetDetail(adAccount, "hash-A", NOW, UNAVAILABLE_INSIGHT);

    expect(detail?.topAudienceLabel).toBe("BROAD");
  });

  it("falls back to the highest-spend audience when no bucket has a real lead yet", () => {
    const low = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(10_000)) }),
    );
    const high = adWithAsset(
      { kind: "IMAGE", imageHash: "hash-A" },
      metrics({ spend: unwrap(Spend.create(200_000)) }),
    );
    const adSetLow = unwrap(new AdSetBuilder().withAds([low]).withAudienceLabel("BROAD").build());
    const adSetHigh = unwrap(
      new AdSetBuilder().withAds([high]).withAudienceLabel("INTEREST").build(),
    );
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSetLow, adSetHigh]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const detail = getAssetDetail(adAccount, "hash-A", NOW, UNAVAILABLE_INSIGHT);

    expect(detail?.topAudienceLabel).toBe("INTEREST");
  });

  it("carries the given insight DTO through unchanged", () => {
    const ad = adWithAsset({ kind: "IMAGE", imageHash: "hash-A" }, metrics());
    const adSet = unwrap(new AdSetBuilder().withAds([ad]).withAudienceLabel("BROAD").build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const detail = getAssetDetail(adAccount, "hash-A", NOW, {
      available: true,
      kaiTake: "Kai take nyata.",
      samanthaVerdict: "Samantha verdict nyata.",
    });

    expect(detail?.insight).toEqual({
      available: true,
      kaiTake: "Kai take nyata.",
      samanthaVerdict: "Samantha verdict nyata.",
    });
  });

  it("reports maxFrequency (non-additive) across every matching ad", () => {
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

    const detail = getAssetDetail(adAccount, "hash-A", NOW, UNAVAILABLE_INSIGHT);

    expect(detail?.maxFrequency).toBe(4);
  });

  it("returns generatedAt/adAccountId/assetKind/assetId honestly", () => {
    const ad = adWithAsset({ kind: "VIDEO", videoId: "vid-1" }, metrics());
    const adSet = unwrap(new AdSetBuilder().withAds([ad]).withAudienceLabel("BROAD").build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount([campaign]);

    const detail = getAssetDetail(adAccount, "vid-1", NOW, UNAVAILABLE_INSIGHT);

    expect(detail?.adAccountId).toBe("act_752604553578354");
    expect(detail?.generatedAt).toBe(NOW.toISOString());
    expect(detail?.assetKind).toBe("VIDEO");
    expect(detail?.assetId).toBe("vid-1");
  });
});
