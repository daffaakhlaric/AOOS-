import type { AdSummaryDto, CampaignSummaryDto } from "@/types/dashboard.types";

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — pure, exported-for-tests math shared by `UnifiedCampaignTable.tsx`
 * (CPL color pill / frequency warning per row) and `CampaignInsightPanel.tsx` (6-KPI grid + the
 * LLM request body's aggregated fields). Every function here operates only on real, already-loaded
 * `AdSummaryDto`/`CampaignSummaryDto` data (`AdAccountSummaryDto` from `GET /api/campaigns`) —
 * nothing is estimated or re-pulled, same discipline `MetricsTab.tsx`'s own `aggregateAdMetrics`
 * establishes (this file mirrors that exact aggregation, scoped to one campaign at a time, so the
 * unified table's per-row numbers and the insight panel's KPI grid can never drift apart).
 */

export type CplTone = "good" | "warn" | "bad" | "unknown";

/** Real, division-by-zero-safe CPL — `null` (never a fabricated 0) when `totalLead` is 0. */
export function computeCpl(spend: number, totalLead: number): number | null {
  return totalLead > 0 ? spend / totalLead : null;
}

/**
 * Real Rp/Chat for one ad — `conversations > 0 ? spend / conversations : null`, same convention
 * `AnalisaClient.tsx`/`AuditClient.tsx`/`StrategiClient.tsx` already use for this exact ratio.
 * Exported here (SAMANTHA ADVANCED SPRINT 2) so `CampaignAdDrillDown.tsx`'s per-ad diagnosis request
 * AND `CampaignInsightPanel.tsx`'s new per-ad breakdown in the campaign-insight request body share
 * the exact same real computation — never two independently-drifting copies of the same ratio.
 */
export function rphChatIDR(spend: number, conversations: number): number | null {
  return conversations > 0 ? spend / conversations : null;
}

/**
 * CPL color-pill tone per this task's own spec: green when strictly below 85% of the real
 * benchmark CPL, amber within [85%, 115%], red above 115%. `"unknown"` (a neutral, undyed pill)
 * when either the campaign has no real CPL yet (0 leads) or no real benchmark is available at all
 * — never a fabricated green/red guess with nothing real to compare against.
 */
export function cplTone(cpl: number | null, benchmarkCplIDR: number | null): CplTone {
  if (cpl === null || benchmarkCplIDR === null || benchmarkCplIDR <= 0) {
    return "unknown";
  }
  const ratio = cpl / benchmarkCplIDR;
  if (ratio < 0.85) {
    return "good";
  }
  if (ratio <= 1.15) {
    return "warn";
  }
  return "bad";
}

export const FREQUENCY_WARNING_THRESHOLD = 3.5;

export function isFrequencyWarning(maxFrequency: number): boolean {
  return maxFrequency > FREQUENCY_WARNING_THRESHOLD;
}

export interface CampaignAggregate {
  readonly spend: number;
  readonly clicks: number;
  readonly totalLead: number;
  readonly impressions: number | null;
  readonly maxFrequency: number;
  readonly adCount: number;
  readonly adSetCount: number;
}

export function flattenCampaignAds(campaign: CampaignSummaryDto): readonly AdSummaryDto[] {
  return campaign.adSets.flatMap((adSet) => adSet.ads);
}

/** Real per-campaign aggregate — same sum/max convention `MetricsTab.tsx`'s `aggregateAdMetrics` uses (impressions is `null`, not summed-as-0, when no ad in this campaign carries a real value). */
export function aggregateCampaign(campaign: CampaignSummaryDto): CampaignAggregate {
  const ads = flattenCampaignAds(campaign);
  let spend = 0;
  let clicks = 0;
  let totalLead = 0;
  let impressionsSum = 0;
  let impressionsKnown = false;
  let maxFrequency = 0;
  for (const ad of ads) {
    spend += ad.metrics.spend;
    clicks += ad.metrics.clicks;
    totalLead += ad.metrics.totalLead;
    if (ad.metrics.impressions !== undefined) {
      impressionsSum += ad.metrics.impressions;
      impressionsKnown = true;
    }
    maxFrequency = Math.max(maxFrequency, ad.metrics.frequency);
  }
  return {
    spend,
    clicks,
    totalLead,
    impressions: impressionsKnown ? impressionsSum : null,
    maxFrequency,
    adCount: ads.length,
    adSetCount: campaign.adSets.length,
  };
}

export function ctrFromAggregate(aggregate: CampaignAggregate): number | null {
  return aggregate.impressions !== null && aggregate.impressions > 0
    ? aggregate.clicks / aggregate.impressions
    : null;
}

/**
 * Real account-wide benchmark CPL fallback: total spend / total leads across every REAL campaign
 * in the current snapshot. Used whenever the tenant's own `property_objectives.targetCpl` business
 * context has not been filled in (see `ObjectiveStripCard.tsx`) — `null` when the whole account has
 * 0 real leads (a brand-new tenant), never a fabricated number.
 */
export function accountBenchmarkCpl(campaigns: readonly CampaignSummaryDto[]): number | null {
  let spend = 0;
  let totalLead = 0;
  for (const campaign of campaigns) {
    const aggregate = aggregateCampaign(campaign);
    spend += aggregate.spend;
    totalLead += aggregate.totalLead;
  }
  return totalLead > 0 ? spend / totalLead : null;
}
