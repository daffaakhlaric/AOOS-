import type { Result } from "@aos/common";

import type { MetaApiError } from "../domain/errors/index.js";
import type {
  MetaAdListResponse,
  MetaAdSetListResponse,
  MetaCampaignListResponse,
  MetaUpdateResponse,
} from "../types/MetaApiTypes.js";

/** Optional pagination cursor, from a previous page's `paging.cursors.after`. */
export interface PageCursor {
  readonly after?: string;
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
}
