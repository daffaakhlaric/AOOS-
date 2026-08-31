import {
  Rph,
  type Ad,
  type AdAccount,
  type AudienceLabel,
  type CreativeAsset,
} from "@aos/meta-ads-connector";

import type { AssetInsightResponseDto } from "../llm/dto/asset-insight.dto.js";

import type {
  AssetDetailAudienceBreakdownDto,
  AssetDetailCopyVariantDto,
  AssetDetailResponseDto,
} from "./dto/asset-detail.dto.js";

/** Same real, documented bucket-priority order `heatmap-rollup.ts`'s own `AUDIENCE_LABEL_ORDER` uses. */
const AUDIENCE_LABEL_ORDER: readonly AudienceLabel[] = [
  "BROAD",
  "INTEREST",
  "LOOKALIKE_1",
  "RETARGETING",
  "CUSTOM_CRM",
];

function assetIdOf(asset: CreativeAsset): string {
  return asset.kind === "IMAGE" ? asset.imageHash : asset.videoId;
}

interface MatchedAd {
  readonly ad: Ad;
  readonly audienceLabel: AudienceLabel | undefined;
}

/**
 * Every real ad across the whole pulled `AdAccount` tree whose `creativeAsset` matches the given
 * `assetId` (either kind — the real heatmap `Link` this page's caller follows carries only the raw
 * asset id, no kind, so a genuine but practically-nil IMAGE-hash-vs-VIDEO-id collision is resolved
 * by matching whichever kind the id actually belongs to; real Meta `image_hash`/`video_id` values
 * never collide in practice, but this function is honest about matching by id alone, not by an
 * assumed kind).
 */
function findMatchingAds(adAccount: AdAccount, assetId: string): readonly MatchedAd[] {
  const matches: MatchedAd[] = [];
  for (const campaign of adAccount.campaigns) {
    for (const adSet of campaign.adSets) {
      for (const ad of adSet.ads) {
        const asset = ad.creativeAsset;
        if (asset !== undefined && assetIdOf(asset) === assetId) {
          matches.push({ ad, audienceLabel: adSet.audienceLabel });
        }
      }
    }
  }
  return matches;
}

/**
 * `getAssetDetail` — AAOS Analytics Platform Phase 4, "Creative Drill-Down". Pure, side-effect-free
 * (the real LLM insight call is a separate, injected async step the caller — `MetaAdsService`
 * — performs and merges in, keeping this function trivially unit-testable like `getAssetRollup`/
 * `getAudienceCreativeHeatmap`). Returns `undefined` when no real ad in the pulled tree carries
 * this asset id — the controller/service turns that into a real 404, never a fabricated empty
 * detail page.
 */
export function getAssetDetail(
  adAccount: AdAccount,
  assetId: string,
  now: Date,
  insight: AssetInsightResponseDto,
): AssetDetailResponseDto | undefined {
  const matches = findMatchingAds(adAccount, assetId);
  if (matches.length === 0) {
    return undefined;
  }

  const firstAsset = matches[0]?.ad.creativeAsset;
  if (firstAsset === undefined) {
    return undefined;
  }

  const copyVariants: AssetDetailCopyVariantDto[] = matches
    .map(({ ad, audienceLabel }): AssetDetailCopyVariantDto => ({
      adId: ad.metaId,
      stableId: ad.stableId.toString(),
      name: ad.name,
      branch: ad.branch,
      audienceLabel,
      spend: ad.metrics.spend.toNumber(),
      impressions: ad.metrics.impressions,
      clicks: ad.metrics.clicks,
      totalLead: ad.metrics.totalLead,
      frequency: ad.metrics.frequency,
      cpl: ad.metrics.rphLead.value,
    }))
    .sort((a, b) => b.spend - a.spend);

  interface MutableBucket {
    readonly audienceLabel: AudienceLabel;
    adCount: number;
    spend: number;
    impressions: number;
    clicks: number;
    totalLead: number;
    maxFrequency: number;
  }
  const buckets = new Map<AudienceLabel, MutableBucket>();
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalLead = 0;
  let maxFrequency = 0;

  for (const { ad, audienceLabel } of matches) {
    const spend = ad.metrics.spend.toNumber();
    totalSpend += spend;
    totalImpressions += ad.metrics.impressions;
    totalClicks += ad.metrics.clicks;
    totalLead += ad.metrics.totalLead;
    maxFrequency = Math.max(maxFrequency, ad.metrics.frequency);

    if (audienceLabel === undefined) {
      continue;
    }
    const existing = buckets.get(audienceLabel);
    const bucket: MutableBucket =
      existing ??
      ({
        audienceLabel,
        adCount: 0,
        spend: 0,
        impressions: 0,
        clicks: 0,
        totalLead: 0,
        maxFrequency: 0,
      } satisfies MutableBucket);
    bucket.adCount += 1;
    bucket.spend += spend;
    bucket.impressions += ad.metrics.impressions;
    bucket.clicks += ad.metrics.clicks;
    bucket.totalLead += ad.metrics.totalLead;
    bucket.maxFrequency = Math.max(bucket.maxFrequency, ad.metrics.frequency);
    buckets.set(audienceLabel, bucket);
  }

  const audienceBreakdown: AssetDetailAudienceBreakdownDto[] = AUDIENCE_LABEL_ORDER.map((label) =>
    buckets.get(label),
  )
    .filter((bucket): bucket is MutableBucket => bucket !== undefined)
    .map((bucket): AssetDetailAudienceBreakdownDto => ({
      audienceLabel: bucket.audienceLabel,
      adCount: bucket.adCount,
      spend: bucket.spend,
      impressions: bucket.impressions,
      clicks: bucket.clicks,
      totalLead: bucket.totalLead,
      maxFrequency: bucket.maxFrequency,
      cpl: Rph.calculate(bucket.spend, bucket.totalLead).value,
    }));

  const topAudienceLabel = pickTopAudienceLabel(audienceBreakdown);

  return {
    adAccountId: adAccount.id.toString(),
    generatedAt: now.toISOString(),
    assetKind: firstAsset.kind,
    assetId,
    adCount: matches.length,
    spend: totalSpend,
    impressions: totalImpressions,
    clicks: totalClicks,
    totalLead,
    maxFrequency,
    rphLead: Rph.calculate(totalSpend, totalLead).value,
    copyVariants,
    audienceBreakdown,
    topAudienceLabel,
    insight,
  };
}

/**
 * Lowest real CPL among buckets with at least one real lead; falls back to the highest-spend
 * bucket when none has a lead yet (still a real, honest signal — "where the budget mostly went" —
 * never a fabricated pick); `undefined` only when there are no buckets at all.
 */
function pickTopAudienceLabel(
  audienceBreakdown: readonly AssetDetailAudienceBreakdownDto[],
): AudienceLabel | undefined {
  const withLeads = audienceBreakdown.filter((row) => row.cpl !== null && row.totalLead > 0);
  if (withLeads.length > 0) {
    const best = [...withLeads].sort((a, b) => (a.cpl ?? 0) - (b.cpl ?? 0))[0];
    return best?.audienceLabel;
  }
  const bySpend = [...audienceBreakdown].sort((a, b) => b.spend - a.spend)[0];
  return bySpend?.audienceLabel;
}
