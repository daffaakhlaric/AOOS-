import { Rph, type Ad, type AdAccount, type CreativeAsset } from "@aos/meta-ads-connector";

import type { AssetRollupItemDto, AssetRollupResponseDto } from "./dto/asset-rollup.dto.js";

interface MutableBucket {
  readonly kind: CreativeAsset["kind"];
  readonly assetId: string;
  adCount: number;
  spend: number;
  impressions: number;
  clicks: number;
  totalLead: number;
  maxFrequency: number;
}

function bucketKey(asset: CreativeAsset): string {
  const assetId = asset.kind === "IMAGE" ? asset.imageHash : asset.videoId;
  return `${asset.kind}:${assetId}`;
}

function assetIdOf(asset: CreativeAsset): string {
  return asset.kind === "IMAGE" ? asset.imageHash : asset.videoId;
}

function everyAd(adAccount: AdAccount): readonly Ad[] {
  const ads: Ad[] = [];
  for (const campaign of adAccount.campaigns) {
    for (const adSet of campaign.adSets) {
      ads.push(...adSet.ads);
    }
  }
  return ads;
}

/**
 * Pure, side-effect-free rollup of every real ad's `creativeAsset` across an `AdAccount`'s whole
 * pulled campaign→adset→ad tree — `getAssetRollup`-shaped per the coordinator note (AAOS Analytics
 * Platform Phase 2, "Asset-First Analytics"). Reuses this codebase's own established aggregation
 * convention (see `AssetRollupItemDto`'s own docstring): additive fields summed, `frequency`
 * reported as the non-additive MAX among constituents, `rphLead` recomputed from the bucket's own
 * summed spend/totalLead via `Rph.calculate` rather than summed from per-ad rates.
 */
export function getAssetRollup(adAccount: AdAccount, now: Date): AssetRollupResponseDto {
  const buckets = new Map<string, MutableBucket>();
  let untaggedAdCount = 0;

  for (const ad of everyAd(adAccount)) {
    const asset = ad.creativeAsset;
    if (asset === undefined) {
      untaggedAdCount += 1;
      continue;
    }

    const key = bucketKey(asset);
    const existing = buckets.get(key);
    const bucket: MutableBucket =
      existing ??
      ({
        kind: asset.kind,
        assetId: assetIdOf(asset),
        adCount: 0,
        spend: 0,
        impressions: 0,
        clicks: 0,
        totalLead: 0,
        maxFrequency: 0,
      } satisfies MutableBucket);

    bucket.adCount += 1;
    bucket.spend += ad.metrics.spend.toNumber();
    bucket.impressions += ad.metrics.impressions;
    bucket.clicks += ad.metrics.clicks;
    bucket.totalLead += ad.metrics.totalLead;
    bucket.maxFrequency = Math.max(bucket.maxFrequency, ad.metrics.frequency);

    buckets.set(key, bucket);
  }

  const assets: AssetRollupItemDto[] = Array.from(buckets.values())
    .map((bucket): AssetRollupItemDto => ({
      assetKind: bucket.kind,
      assetId: bucket.assetId,
      adCount: bucket.adCount,
      spend: bucket.spend,
      impressions: bucket.impressions,
      clicks: bucket.clicks,
      totalLead: bucket.totalLead,
      maxFrequency: bucket.maxFrequency,
      rphLead: Rph.calculate(bucket.spend, bucket.totalLead).value,
    }))
    // Highest spend first — the natural "which creative asset matters most" reading order for
    // this rollup, same "most-consequential-first" instinct `StableIdAssigner`'s spend-sort
    // already establishes for campaigns/ad sets/ads.
    .sort((a, b) => b.spend - a.spend);

  return {
    adAccountId: adAccount.id.toString(),
    generatedAt: now.toISOString(),
    assets,
    untaggedAdCount,
  };
}
