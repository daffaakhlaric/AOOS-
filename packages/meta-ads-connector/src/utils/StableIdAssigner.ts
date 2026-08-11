import { err, ok, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import type { Ad } from "../domain/entities/Ad.js";
import type { AdSet } from "../domain/entities/AdSet.js";
import type { Campaign } from "../domain/entities/Campaign.js";
import { StableId, type StableIdPrefix } from "../domain/value-objects/StableId.js";

/**
 * Assigns deterministic, per-sync-snapshot `StableId`s (`#A001`, `#B001`, `#C001`, ...), per the
 * spec's Stable ID Assignment rule: sorted by spend DESC within scope, sequentially numbered from 1.
 *
 * Tie-break rule (undocumented by the spec, so a documented judgment call): items with equal
 * spend are sorted by `metaId` ascending (lexicographic) as the secondary key. `metaId` is chosen
 * over `name` because it is guaranteed unique and stable across syncs (two campaigns can share a
 * name; they cannot share a Meta id), which keeps the resulting order — and therefore the
 * assigned `#A/#B/#C` numbers — deterministic and reproducible run-to-run for a byte-identical
 * input snapshot, which `name`-based tie-breaking would not guarantee once duplicate names exist.
 */
function sortBySpendDescThenMetaId<T extends { metaId: string }>(
  items: ReadonlyArray<T>,
  getSpendAmount: (item: T) => number,
): T[] {
  return [...items].sort((a, b) => {
    const spendDiff = getSpendAmount(b) - getSpendAmount(a);
    if (spendDiff !== 0) {
      return spendDiff;
    }
    return a.metaId < b.metaId ? -1 : a.metaId > b.metaId ? 1 : 0;
  });
}

function assignSequential<T>(
  sorted: ReadonlyArray<T>,
  prefix: StableIdPrefix,
  withStableId: (item: T, stableId: StableId) => T,
): Result<T[], ValidationError> {
  const result: T[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const stableIdResult = StableId.create(prefix, i + 1);
    if (!stableIdResult.ok) {
      return err(stableIdResult.error);
    }
    result.push(withStableId(sorted[i] as T, stableIdResult.value));
  }
  return ok(result);
}

/** Re-sorts and re-assigns `#C` ids to a scope's ads (spend DESC), independent of adset grouping. */
export function assignAdStableIds(ads: ReadonlyArray<Ad>): Result<Ad[], ValidationError> {
  const sorted = sortBySpendDescThenMetaId(ads, (ad) => ad.metrics.spend.toNumber());
  return assignSequential(sorted, "C", (ad, stableId) => ad.withStableId(stableId));
}

/** Re-sorts and re-assigns `#B` ids to a scope's adsets (spend DESC), also cascading `#C` re-assignment to each adset's ads (scoped per adset, per the spec's "AdSets sorted by spend DESC" / "Ads sorted by spend DESC" being independent scopes). */
export function assignAdSetStableIds(
  adSets: ReadonlyArray<AdSet>,
): Result<AdSet[], ValidationError> {
  const sorted = sortBySpendDescThenMetaId(adSets, (adSet) => adSet.spend.toNumber());
  const withCIds: AdSet[] = [];
  for (const adSet of sorted) {
    const adsResult = assignAdStableIds(adSet.ads);
    if (!adsResult.ok) {
      return err(adsResult.error);
    }
    withCIds.push(adSet.withAds(adsResult.value));
  }
  return assignSequential(withCIds, "B", (adSet, stableId) => adSet.withStableId(stableId));
}

/** Re-sorts and re-assigns `#A` ids to an account's campaigns (spend DESC), cascading `#B`/`#C` re-assignment down through adsets and ads. */
export function assignCampaignStableIds(
  campaigns: ReadonlyArray<Campaign>,
): Result<Campaign[], ValidationError> {
  const sorted = sortBySpendDescThenMetaId(campaigns, (campaign) => campaign.spend.toNumber());
  const withDescendantIds: Campaign[] = [];
  for (const campaign of sorted) {
    const adSetsResult = assignAdSetStableIds(campaign.adSets);
    if (!adSetsResult.ok) {
      return err(adSetsResult.error);
    }
    withDescendantIds.push(campaign.withAdSets(adSetsResult.value));
  }
  return assignSequential(withDescendantIds, "A", (campaign, stableId) =>
    campaign.withStableId(stableId),
  );
}
