import type { CampaignSummaryDto } from "@/types/dashboard.types";

/**
 * Re-implemented from apps/eyvra-dashboard's real verdict-aggregation logic
 * (components/meta-ads/CampaignTree.tsx's `aggregateVerdict` + components/campaigns/
 * campaignInsightMath.ts's `aggregateCampaign`/`computeCpl`) — same algorithm, not a second,
 * independently-invented one. aaos-api only computes `verdict` per-ad; a campaign's own verdict is
 * the most-severe real verdict among its descendant ads (FIX > PAUSE > SCALE > REFRESH > KEEP >
 * REVIEW).
 */
const VERDICT_PRIORITY = ["FIX", "PAUSE", "SCALE", "REFRESH", "KEEP", "REVIEW"] as const;

export function aggregateVerdict(verdicts: readonly string[]): string {
  for (const candidate of VERDICT_PRIORITY) {
    if (verdicts.includes(candidate)) {
      return candidate;
    }
  }
  return verdicts[0] ?? "REVIEW";
}

export function computeCpl(spend: number, totalLead: number): number | null {
  return totalLead > 0 ? spend / totalLead : null;
}

interface CampaignAggregate {
  readonly spend: number;
  readonly totalLead: number;
}

/** Sum of real per-ad spend/leads across every ad set/ad of one campaign. */
export function aggregateCampaign(campaign: CampaignSummaryDto): CampaignAggregate {
  let spend = 0;
  let totalLead = 0;
  for (const adSet of campaign.adSets) {
    for (const ad of adSet.ads) {
      spend += ad.metrics.spend;
      totalLead += ad.metrics.totalLead;
    }
  }
  return { spend, totalLead };
}

export interface CampaignVerdictRow {
  readonly campaign: CampaignSummaryDto;
  readonly verdict: string;
  readonly spend: number;
  readonly cpl: number | null;
}

/**
 * Real, deterministic per-campaign verdict + spend/CPL — the exact same computation
 * apps/eyvra-dashboard's `CommandCenterClient.tsx`'s own `computeCampaignVerdicts` performs
 * (same ad-level-spend-available fallback to the real campaign-level spend for a delayed ad-level
 * pull), re-implemented here rather than cross-imported.
 */
export function computeCampaignVerdicts(
  campaigns: readonly CampaignSummaryDto[],
): readonly CampaignVerdictRow[] {
  return campaigns.map((campaign) => {
    const verdict = aggregateVerdict(
      campaign.adSets.flatMap((adSet) => adSet.ads.map((ad) => ad.verdict)),
    );
    const aggregate = aggregateCampaign(campaign);
    const adLevelSpendAvailable = aggregate.spend > 0;
    const spend = adLevelSpendAvailable ? aggregate.spend : campaign.spend;
    const cpl = adLevelSpendAvailable ? computeCpl(aggregate.spend, aggregate.totalLead) : null;
    return { campaign, verdict, spend, cpl };
  });
}

/** Re-implemented 1:1 from apps/eyvra-dashboard/src/lib/adName.ts's `stripAdNameSuffix` — strips a trailing UUID-looking suffix some real Meta-auto-named campaigns/ads carry. Display-only; never used as an identifier. */
const UUID_PATTERN = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const GENERIC_UUID_SHAPED = "[0-9a-fA-F]{8}-[0-9a-fA-F-]+";
const SEP = "[-–—·]";
const TIER = "(?:Boost|platinum|gold|silver|bronze|diamond)";
const TIER_CHAIN = `(?:\\s*${SEP}\\s*${TIER})+`;
const SUFFIX_PATTERN = new RegExp(
  `(?:${TIER_CHAIN}\\s+${UUID_PATTERN}` +
    `|\\s*${SEP}\\s*Ad\\s+${UUID_PATTERN}` +
    `|\\s*·\\s*${UUID_PATTERN}` +
    `|\\s*${SEP}\\s*${GENERIC_UUID_SHAPED})$`,
  "i",
);

export function stripAdNameSuffix(name: string): string {
  return name.replace(SUFFIX_PATTERN, "");
}
