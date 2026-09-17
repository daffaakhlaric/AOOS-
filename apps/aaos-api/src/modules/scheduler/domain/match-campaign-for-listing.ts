import type { Verdict, AdStatus, type AdAccount, type Campaign } from "@aos/meta-ads-connector";

import type { ListingResponseDto } from "../../listings/dto/listing.dto.js";

/** One listing's real, active-campaign-matched signals (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase C point 4). See `runPropertyCampaignTriggerCheck`'s doc for the matching heuristic's honest limitation. */
export interface MatchedCampaignSignals {
  readonly hasActiveCampaign: boolean;
  readonly maxFrequency?: number;
  readonly cplIDR?: number;
  /**
   * AAOS LOOP UPGRADE, Sprint 8a — every real per-ad `Verdict` (`ad.verdict`, already computed
   * upstream, the SAME value `toAnalyzeCampaigns` reports) across this listing's matched active
   * campaign(s) — the real input `evaluateNeedCreative`'s condition (a) needs. Empty array (not
   * `undefined`) when a campaign matched but has zero ads; `undefined` semantics are reserved for
   * "no matched campaign at all", handled by `hasActiveCampaign: false` instead.
   */
  readonly verdicts: readonly Verdict[];
  /**
   * Samantha Andromeda-Aware Campaign System, Sprint 1 — the real, already-loaded `Campaign`
   * entities (full `adSets`/`ads` tree, no second Meta pull) that matched this listing, reused by
   * `runAndromedaRestructureCheck` to compute a real per-campaign ad-set count + creative
   * diversity score. Empty array when `hasActiveCampaign` is `false`.
   */
  readonly matchedCampaigns: readonly Campaign[];
}

/**
 * Pure — matches `listing` against every `AdStatus.ACTIVE` campaign across `adAccounts` whose real
 * `name` contains the listing's real `title` (case-insensitive substring; no `listings.campaign_id`
 * column exists anywhere in this schema to join on instead), and aggregates that campaign's real
 * ad-level `frequency`/spend/lead metrics.
 *
 * Lives in its own file (not inline in `scheduler.service.ts`, where it originated) so
 * `CampaignsService.backfillListingLinks` (Campaign->Listing Mapping backfill) can reuse the SAME
 * real matching heuristic `SchedulerService` relies on without creating a circular file import
 * between `campaigns.service.ts` and `scheduler.service.ts` (the latter already injects
 * `CampaignsService` itself).
 */
export function matchActiveCampaignForListing(
  listing: ListingResponseDto,
  adAccounts: readonly AdAccount[],
): MatchedCampaignSignals {
  const needle = listing.title.toLowerCase();
  let hasActiveCampaign = false;
  let maxFrequency: number | undefined;
  let totalSpend = 0;
  let totalLeads = 0;
  const verdicts: Verdict[] = [];
  const matchedCampaigns: Campaign[] = [];

  const isMatch = (campaign: Campaign): boolean =>
    campaign.status === AdStatus.ACTIVE && campaign.name.toLowerCase().includes(needle);

  for (const account of adAccounts) {
    for (const campaign of account.campaigns) {
      if (!isMatch(campaign)) {
        continue;
      }
      hasActiveCampaign = true;
      matchedCampaigns.push(campaign);
      for (const adSet of campaign.adSets) {
        for (const ad of adSet.ads) {
          maxFrequency =
            maxFrequency === undefined
              ? ad.metrics.frequency
              : Math.max(maxFrequency, ad.metrics.frequency);
          totalSpend += ad.metrics.spend.toNumber();
          totalLeads += ad.metrics.totalLead;
          verdicts.push(ad.verdict);
        }
      }
    }
  }

  const cplIDR = totalLeads > 0 ? totalSpend / totalLeads : undefined;
  return {
    hasActiveCampaign,
    ...(maxFrequency !== undefined ? { maxFrequency } : {}),
    ...(cplIDR !== undefined ? { cplIDR } : {}),
    verdicts,
    matchedCampaigns,
  };
}
