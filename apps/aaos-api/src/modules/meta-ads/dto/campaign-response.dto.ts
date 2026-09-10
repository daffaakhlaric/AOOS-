import type { Ad, AdAccount, AdSet, Campaign } from "@aos/meta-ads-connector";

export interface AdMetricsResponseDto {
  readonly spend: number;
  readonly impressions: number;
  readonly reach: number;
  readonly frequency: number;
  readonly clicks: number;
  readonly conversations: number;
  readonly d2: number;
  readonly d3: number;
  readonly d5: number;
  readonly leadForm: number;
  readonly totalLead: number;
  readonly rphChat: number | null;
  readonly rphD3: number | null;
  readonly rphLead: number | null;
}

export interface AdResponseDto {
  readonly id: string;
  readonly stableId: string;
  readonly metaId: string;
  readonly name: string;
  readonly status: string;
  readonly funnel: string;
  readonly branch: string;
  readonly verdict: string;
  readonly metrics: AdMetricsResponseDto;
  readonly createdAt: string;
  readonly daysSinceCreation: number;
  /**
   * AAOS Samantha Professional Optimizer, Part B/D — real, already-pulled ad-copy text (Part B's
   * `Ad.primaryText`/`.headline`/`.description`), surfaced here so the dashboard can show Samantha's
   * real structural/Pain-Offer-USP diagnosis (`POST /api/v1/campaigns/diagnose-ad-copy`) for this
   * exact ad without a second round-trip to re-fetch its copy. Each independently `undefined` when
   * Meta's real creative for this ad doesn't carry it (see `Ad.ts`'s own docstring) — never a
   * fabricated placeholder.
   */
  readonly primaryText?: string;
  readonly headline?: string;
  readonly description?: string;
}

export interface AdSetResponseDto {
  readonly id: string;
  readonly stableId: string;
  readonly metaId: string;
  readonly name: string;
  readonly status: string;
  readonly branch: string;
  readonly dailyBudget: number;
  readonly spend: number;
  readonly ads: ReadonlyArray<AdResponseDto>;
  /**
   * AAOS Samantha Professional Optimizer, Part A/D — real Meta `learning_stage_info.status`
   * (`AdSet.learningStatus`), `undefined` when Meta didn't report one for this adset (see
   * `AdSet.ts`'s own docstring). Surfaced so the dashboard can show a real "Masih Learning Phase"
   * signal and so `VerdictEngine`'s own learning-phase-aware verdict is explainable to a human.
   */
  readonly learningStatus?: string;
}

export interface CampaignResponseDto {
  readonly id: string;
  readonly stableId: string;
  readonly metaId: string;
  readonly name: string;
  readonly objective: string;
  readonly status: string;
  readonly funnel: string;
  readonly branch: string;
  readonly spend: number;
  readonly createdAt: string;
  readonly adSets: ReadonlyArray<AdSetResponseDto>;
}

/** `GET /api/v1/campaigns` response body — a plain-JSON serialization of `@aos/meta-ads-connector`'s `AdAccount` aggregate, since its Value Objects (`AdAccountId`, `Spend`, `Rph`, ...) are not directly JSON-serializable (private internal state, no `toJSON`). */
export interface AdAccountResponseDto {
  readonly id: string;
  readonly name: string;
  readonly businessManagerId: string;
  readonly currency: string;
  readonly timezone: string;
  readonly syncedAt: string;
  readonly campaigns: ReadonlyArray<CampaignResponseDto>;
}

export function toAdAccountResponseDto(adAccount: AdAccount): AdAccountResponseDto {
  return {
    id: adAccount.id.toString(),
    name: adAccount.name,
    businessManagerId: adAccount.businessManagerId,
    currency: adAccount.currency,
    timezone: adAccount.timezone,
    syncedAt: adAccount.syncedAt.toISOString(),
    campaigns: adAccount.campaigns.map(toCampaignResponseDto),
  };
}

function toCampaignResponseDto(campaign: Campaign): CampaignResponseDto {
  return {
    id: campaign.id.toString(),
    stableId: campaign.stableId.toString(),
    metaId: campaign.metaId,
    name: campaign.name,
    objective: campaign.objective,
    status: campaign.status,
    funnel: campaign.funnel,
    branch: campaign.branch,
    spend: campaign.spend.toNumber(),
    createdAt: campaign.createdAt.toISOString(),
    adSets: campaign.adSets.map(toAdSetResponseDto),
  };
}

function toAdSetResponseDto(adSet: AdSet): AdSetResponseDto {
  return {
    id: adSet.id.toString(),
    stableId: adSet.stableId.toString(),
    metaId: adSet.metaId,
    name: adSet.name,
    status: adSet.status,
    branch: adSet.branch,
    dailyBudget: adSet.dailyBudget.toNumber(),
    spend: adSet.spend.toNumber(),
    ads: adSet.ads.map(toAdResponseDto),
    ...(adSet.learningStatus !== undefined ? { learningStatus: adSet.learningStatus } : {}),
  };
}

function toAdResponseDto(ad: Ad): AdResponseDto {
  return {
    id: ad.id.toString(),
    stableId: ad.stableId.toString(),
    metaId: ad.metaId,
    name: ad.name,
    status: ad.status,
    funnel: ad.funnel,
    branch: ad.branch,
    verdict: ad.verdict,
    metrics: {
      spend: ad.metrics.spend.toNumber(),
      impressions: ad.metrics.impressions,
      reach: ad.metrics.reach,
      frequency: ad.metrics.frequency,
      clicks: ad.metrics.clicks,
      conversations: ad.metrics.conversations,
      d2: ad.metrics.d2,
      d3: ad.metrics.d3,
      d5: ad.metrics.d5,
      leadForm: ad.metrics.leadForm,
      totalLead: ad.metrics.totalLead,
      rphChat: ad.metrics.rphChat.value,
      rphD3: ad.metrics.rphD3.value,
      rphLead: ad.metrics.rphLead.value,
    },
    createdAt: ad.createdAt.toISOString(),
    daysSinceCreation: ad.daysSinceCreation,
    ...(ad.primaryText !== undefined ? { primaryText: ad.primaryText } : {}),
    ...(ad.headline !== undefined ? { headline: ad.headline } : {}),
    ...(ad.description !== undefined ? { description: ad.description } : {}),
  };
}
