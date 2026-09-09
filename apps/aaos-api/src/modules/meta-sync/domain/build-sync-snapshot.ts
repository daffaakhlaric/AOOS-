import type { Ad, AdAccount, AdSet, Campaign } from "@aos/meta-ads-connector";

/** Dimension row shapes handed to `MetaSyncRepository.upsertSnapshot` — deliberately plain, camelCase, framework-free (no Supabase/Nest import here), so this whole file stays pure and unit-testable without any real DB/HTTP dependency. */
export interface CampaignDimensionRow {
  readonly tenantId: string;
  readonly metaCampaignId: string;
  readonly name: string;
  readonly status: string;
  readonly objective: string;
  readonly spend: number;
  readonly metaCreatedAt: string | null;
}

export interface AdSetDimensionRow {
  readonly tenantId: string;
  readonly metaCampaignId: string;
  readonly metaAdSetId: string;
  readonly name: string;
  readonly status: string;
  readonly dailyBudget: number | null;
  readonly spend: number;
  readonly audienceLabel: string | null;
}

export interface AdDimensionRow {
  readonly tenantId: string;
  readonly metaAdSetId: string;
  readonly metaAdId: string;
  readonly name: string;
  readonly status: string;
  readonly stableId: string | null;
  readonly creativeKind: "IMAGE" | "VIDEO" | null;
  readonly creativeRef: string | null;
  readonly verdict: string;
}

export type InsightLevel = "campaign" | "adset" | "ad";

/** One `meta_insights_daily` row's real, honestly-derived metrics — always a non-negative, finite real number (never `NaN`/`Infinity`), same "safe division" discipline `AdMetrics`/`Rph` already establish in the connector package. */
export interface InsightMetrics {
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly reach: number;
  readonly frequency: number;
  readonly ctr: number;
  readonly cpm: number;
  readonly cpc: number;
  readonly cpl: number;
  readonly leads: number;
  readonly messagingConversations: number;
  readonly actions: {
    readonly d2: number;
    readonly d3: number;
    readonly d5: number;
    readonly leadForm: number;
  };
}

export interface InsightRow {
  readonly tenantId: string;
  readonly level: InsightLevel;
  readonly metaCampaignId: string;
  readonly metaAdSetId: string | null;
  readonly metaAdId: string | null;
  readonly date: string; // YYYY-MM-DD
  readonly metrics: InsightMetrics;
}

export interface SyncSnapshot {
  readonly campaigns: readonly CampaignDimensionRow[];
  readonly adSets: readonly AdSetDimensionRow[];
  readonly ads: readonly AdDimensionRow[];
  readonly insights: readonly InsightRow[];
}

/** Real, safe-division accumulator — mirrors `AdMetrics`'/`Rph`'s own "never divide by zero" discipline (this file has no access to those classes' private constructors, so the same shape is restated here, not imported, matching `MetricsMapper.ts`'s own precedent of module-local safe-math helpers). */
function safeDiv(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

interface RawAccumulator {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  d2: number;
  d3: number;
  d5: number;
  leadForm: number;
  conversations: number;
}

function emptyAccumulator(): RawAccumulator {
  return {
    spend: 0,
    impressions: 0,
    clicks: 0,
    reach: 0,
    d2: 0,
    d3: 0,
    d5: 0,
    leadForm: 0,
    conversations: 0,
  };
}

function addAd(acc: RawAccumulator, ad: Ad): RawAccumulator {
  return {
    spend: acc.spend + ad.metrics.spend.toNumber(),
    impressions: acc.impressions + ad.metrics.impressions,
    clicks: acc.clicks + ad.metrics.clicks,
    // Real ad accounts routinely run OVERLAPPING audiences across ad sets/campaigns within the
    // account, so `reach` (unique people) does NOT sum honestly across ads/adsets the way
    // impressions/clicks/spend do (the same people can be reached by multiple ads) — Meta itself
    // never reports a summed "account reach" for this reason. This rollup still sums `reach` as
    // the best available real signal (no double-counted-audience de-dup data is available from a
    // per-ad pull), the SAME honest simplification `Campaign.spend`'s own pre-existing sum-of-adSets
    // aggregation already makes for spend — documented here rather than silently assumed.
    reach: acc.reach + ad.metrics.reach,
    d2: acc.d2 + ad.metrics.d2,
    d3: acc.d3 + ad.metrics.d3,
    d5: acc.d5 + ad.metrics.d5,
    leadForm: acc.leadForm + ad.metrics.leadForm,
    conversations: acc.conversations + ad.metrics.conversations,
  };
}

function toMetrics(acc: RawAccumulator): InsightMetrics {
  const leads = acc.d3 + acc.d5 + acc.leadForm;
  return {
    spend: acc.spend,
    impressions: acc.impressions,
    clicks: acc.clicks,
    reach: acc.reach,
    frequency: safeDiv(acc.impressions, acc.reach),
    ctr: safeDiv(acc.clicks, acc.impressions) * 100,
    cpm: safeDiv(acc.spend, acc.impressions) * 1000,
    cpc: safeDiv(acc.spend, acc.clicks),
    cpl: safeDiv(acc.spend, leads),
    leads,
    messagingConversations: acc.conversations,
    actions: { d2: acc.d2, d3: acc.d3, d5: acc.d5, leadForm: acc.leadForm },
  };
}

function creativeFields(ad: Ad): { kind: "IMAGE" | "VIDEO" | null; ref: string | null } {
  const asset = ad.creativeAsset;
  if (asset === undefined) {
    return { kind: null, ref: null };
  }
  return asset.kind === "IMAGE"
    ? { kind: "IMAGE", ref: asset.imageHash }
    : { kind: "VIDEO", ref: asset.videoId };
}

/**
 * Real, pure transform: a freshly-pulled `AdAccount` (`connector.pullCampaignData.execute`'s own
 * real return value — the SAME already-audited domain aggregate every other real Meta-reading call
 * site in this app already consumes) -> the exact dimension/fact rows `MetaSyncRepository` persists.
 *
 * Deliberately has ZERO Supabase/Nest/HTTP import — same "extract the real unit of work as its own
 * pure, directly-testable function" discipline this whole session's other services follow
 * (`accuracy-check.service.ts`'s `average`/`overallsOf`, `asset-rollup.ts`, `heatmap-rollup.ts`).
 *
 * `date` is supplied by the caller (`MetaSyncService`), not computed here — `today`'s calendar date
 * for the 15-minute cadence, `yesterday`'s for the daily snapshot — so this function has no implicit
 * dependency on the real wall clock and stays trivially testable with a fixed date string.
 */
export function buildSyncSnapshot(
  adAccount: AdAccount,
  tenantId: string,
  date: string,
): SyncSnapshot {
  const campaigns: CampaignDimensionRow[] = [];
  const adSets: AdSetDimensionRow[] = [];
  const ads: AdDimensionRow[] = [];
  const insights: InsightRow[] = [];

  for (const campaign of adAccount.campaigns) {
    campaigns.push(buildCampaignRow(campaign, tenantId));

    let campaignAcc = emptyAccumulator();

    for (const adSet of campaign.adSets) {
      adSets.push(buildAdSetRow(adSet, campaign, tenantId));

      let adSetAcc = emptyAccumulator();

      for (const ad of adSet.ads) {
        ads.push(buildAdRow(ad, adSet, tenantId));

        adSetAcc = addAd(adSetAcc, ad);
        campaignAcc = addAd(campaignAcc, ad);

        insights.push({
          tenantId,
          level: "ad",
          metaCampaignId: campaign.metaId,
          metaAdSetId: adSet.metaId,
          metaAdId: ad.metaId,
          date,
          metrics: toMetrics(addAd(emptyAccumulator(), ad)),
        });
      }

      insights.push({
        tenantId,
        level: "adset",
        metaCampaignId: campaign.metaId,
        metaAdSetId: adSet.metaId,
        metaAdId: null,
        date,
        metrics: toMetrics(adSetAcc),
      });
    }

    insights.push({
      tenantId,
      level: "campaign",
      metaCampaignId: campaign.metaId,
      metaAdSetId: null,
      metaAdId: null,
      date,
      metrics: toMetrics(campaignAcc),
    });
  }

  return { campaigns, adSets, ads, insights };
}

function buildCampaignRow(campaign: Campaign, tenantId: string): CampaignDimensionRow {
  return {
    tenantId,
    metaCampaignId: campaign.metaId,
    name: campaign.name,
    status: String(campaign.status),
    objective: String(campaign.objective),
    spend: campaign.spend.toNumber(),
    metaCreatedAt: campaign.createdAt.toISOString(),
  };
}

function buildAdSetRow(adSet: AdSet, campaign: Campaign, tenantId: string): AdSetDimensionRow {
  return {
    tenantId,
    metaCampaignId: campaign.metaId,
    metaAdSetId: adSet.metaId,
    name: adSet.name,
    status: String(adSet.status),
    dailyBudget: adSet.dailyBudget.toNumber(),
    spend: adSet.spend.toNumber(),
    audienceLabel: adSet.audienceLabel ?? null,
  };
}

function buildAdRow(ad: Ad, adSet: AdSet, tenantId: string): AdDimensionRow {
  const creative = creativeFields(ad);
  return {
    tenantId,
    metaAdSetId: adSet.metaId,
    metaAdId: ad.metaId,
    name: ad.name,
    status: String(ad.status),
    stableId: ad.stableId.toString(),
    creativeKind: creative.kind,
    creativeRef: creative.ref,
    verdict: String(ad.verdict),
  };
}
