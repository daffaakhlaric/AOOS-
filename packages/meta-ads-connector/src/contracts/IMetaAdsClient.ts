import type { Result } from "@aos/common";

import type { MetaApiError } from "../domain/errors/index.js";
import type {
  MetaAdAccountResponse,
  MetaAdListResponse,
  MetaAdSetListResponse,
  MetaCampaignListResponse,
  MetaUpdateResponse,
} from "../types/MetaApiTypes.js";

/** Optional pagination cursor, from a previous page's `paging.cursors.after`. */
export interface PageCursor {
  readonly after?: string;
}

/** Input for `IMetaAdsClient.createCampaign` (AAOS-W1D-S3) — mirrors Meta's `POST /{ad-account}/campaigns` body shape. */
export interface CreateCampaignParams {
  readonly name: string;
  /** Always `"OUTCOME_LEADS"` for AAOS-created campaigns (DSS Motor's real strategy). */
  readonly objective: string;
  readonly specialAdCategories: ReadonlyArray<string>;
  /** Always `"PAUSED"` — DSS approves before activating. */
  readonly status: string;
}

/** Input for `IMetaAdsClient.createAdSet` (AAOS-W1D-S3) — mirrors Meta's `POST /{ad-account}/adsets` body shape. */
export interface CreateAdSetParams {
  readonly campaignId: string;
  readonly name: string;
  /** Always `"WHATSAPP"` for AAOS-created ad sets (CTWA — lead lands in WhatsApp with Jessy). */
  readonly destinationType: string;
  readonly optimizationGoal: string;
  readonly billingEvent: string;
  readonly dailyBudgetCents: number;
  /** Always `"PAUSED"` — DSS approves before activating. */
  readonly status: string;
}

/** Result of `createCampaign`/`createAdSet` — Meta's `POST /{ad-account}/campaigns|adsets` response always includes the new object's `id`. */
export interface MetaCreateResponse {
  readonly id: string;
}

/**
 * Port (Hexagonal Architecture) for talking to the Meta Marketing Graph API. The only
 * implementation shipped in this package is `infrastructure/meta-api/MetaApiClient.ts`
 * (fetch-based); tests substitute MSW-mocked HTTP instead of a fake of this interface,
 * exercising the real adapter. Every method returns a `Promise<Result<T, MetaApiError>>` —
 * never throws, per the package's "never throw" rule.
 */
export interface IMetaAdsClient {
  getCampaigns(
    adAccountId: string,
    accessToken: string,
    datePreset: string,
    cursor?: PageCursor,
  ): Promise<Result<MetaCampaignListResponse, MetaApiError>>;

  getAdSets(
    campaignId: string,
    accessToken: string,
    cursor?: PageCursor,
  ): Promise<Result<MetaAdSetListResponse, MetaApiError>>;

  getAds(
    adSetId: string,
    accessToken: string,
    datePreset: string,
    cursor?: PageCursor,
  ): Promise<Result<MetaAdListResponse, MetaApiError>>;

  /**
   * `GET /{ad_account_id}?fields=name` — resolves a single ad account's human-readable `name`,
   * for the multi-account pill selector (coordinator note #6). Deliberately separate from
   * `getCampaigns` — do NOT reuse the full campaign pull just to read a name.
   */
  getAdAccount(
    adAccountId: string,
    accessToken: string,
  ): Promise<Result<MetaAdAccountResponse, MetaApiError>>;

  pauseAd(adId: string, accessToken: string): Promise<Result<MetaUpdateResponse, MetaApiError>>;

  scaleAdSetBudget(
    adSetId: string,
    newDailyBudgetCents: number,
    accessToken: string,
  ): Promise<Result<MetaUpdateResponse, MetaApiError>>;

  fixCampaignObjective(
    campaignId: string,
    objective: string,
    accessToken: string,
  ): Promise<Result<MetaUpdateResponse, MetaApiError>>;

  /** AAOS-W1D-S3: `POST /{ad-account}/campaigns` — creates a new campaign, always starting `PAUSED`. */
  createCampaign(
    adAccountId: string,
    params: CreateCampaignParams,
    accessToken: string,
  ): Promise<Result<MetaCreateResponse, MetaApiError>>;

  /** AAOS-W1D-S3: `POST /{ad-account}/adsets` — creates a new ad set under a just-created campaign, always starting `PAUSED`. */
  createAdSet(
    adAccountId: string,
    params: CreateAdSetParams,
    accessToken: string,
  ): Promise<Result<MetaCreateResponse, MetaApiError>>;
}
