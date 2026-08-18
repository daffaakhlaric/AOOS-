import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type {
  CreateAdSetParams,
  CreateCampaignParams,
  IMetaAdsClient,
  MetaCreateResponse as ClientMetaCreateResponse,
  PageCursor,
} from "../../contracts/IMetaAdsClient.js";
import {
  ApiServerError,
  AuthError,
  MetaApiError,
  PermissionError,
  RateLimitError,
} from "../../domain/errors/index.js";
import {
  MetaAdAccountResponseSchema,
  type MetaAdAccountResponse,
  MetaAdInterestSearchResponseSchema,
  type MetaAdInterestSearchResponse,
  MetaAdListResponseSchema,
  type MetaAdListResponse,
  MetaAdSetListResponseSchema,
  type MetaAdSetListResponse,
  MetaCampaignListResponseSchema,
  type MetaCampaignListResponse,
  MetaCreateResponseSchema,
  MetaErrorResponseSchema,
  MetaUpdateResponseSchema,
  type MetaUpdateResponse,
} from "../../types/MetaApiTypes.js";

import { MetaApiRequestBuilder } from "./MetaApiRequestBuilder.js";

const META_INVALID_TOKEN_CODE = 190;
const META_MISSING_PERMISSION_CODE = 200;
const DEFAULT_RETRY_AFTER_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 30_000;

export interface MetaApiClientOptions {
  readonly timeoutMs?: number;
  /** Injectable fetch implementation — defaults to the global native `fetch`; overridable for tests (MSW normally suffices, but this keeps the door open for a raw fetch mock too). */
  readonly fetchImpl?: typeof fetch;
}

/**
 * `fetch`-based (no axios/got) implementation of `IMetaAdsClient`. Never throws: every failure
 * mode — HTTP error status, a non-2xx Meta error payload, a network/timeout failure, or a
 * response body that fails Zod validation — is converted to a `Result.err(MetaApiError)`.
 */
export class MetaApiClient implements IMetaAdsClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MetaApiClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getCampaigns(
    adAccountId: string,
    accessToken: string,
    datePreset: string,
    cursor?: PageCursor,
  ): Promise<Result<MetaCampaignListResponse, MetaApiError>> {
    const url = MetaApiRequestBuilder.campaignsUrl(adAccountId, accessToken, datePreset, cursor);
    return this.getJson(url, MetaCampaignListResponseSchema);
  }

  async getAdSets(
    campaignId: string,
    accessToken: string,
    cursor?: PageCursor,
  ): Promise<Result<MetaAdSetListResponse, MetaApiError>> {
    const url = MetaApiRequestBuilder.adSetsUrl(campaignId, accessToken, cursor);
    return this.getJson(url, MetaAdSetListResponseSchema);
  }

  async getAds(
    adSetId: string,
    accessToken: string,
    datePreset: string,
    cursor?: PageCursor,
  ): Promise<Result<MetaAdListResponse, MetaApiError>> {
    const url = MetaApiRequestBuilder.adsUrl(adSetId, accessToken, datePreset, cursor);
    return this.getJson(url, MetaAdListResponseSchema);
  }

  /** See `IMetaAdsClient.getAdAccount` docstring — a single lightweight `fields=name` lookup. */
  async getAdAccount(
    adAccountId: string,
    accessToken: string,
  ): Promise<Result<MetaAdAccountResponse, MetaApiError>> {
    const url = MetaApiRequestBuilder.adAccountUrl(adAccountId, accessToken);
    return this.getJson(url, MetaAdAccountResponseSchema);
  }

  async pauseAd(
    adId: string,
    accessToken: string,
  ): Promise<Result<MetaUpdateResponse, MetaApiError>> {
    return this.postJson(MetaApiRequestBuilder.pauseAdUrl(adId), {
      status: "PAUSED",
      access_token: accessToken,
    });
  }

  async scaleAdSetBudget(
    adSetId: string,
    newDailyBudgetCents: number,
    accessToken: string,
  ): Promise<Result<MetaUpdateResponse, MetaApiError>> {
    return this.postJson(MetaApiRequestBuilder.scaleAdSetUrl(adSetId), {
      daily_budget: newDailyBudgetCents,
      access_token: accessToken,
    });
  }

  async fixCampaignObjective(
    campaignId: string,
    objective: string,
    accessToken: string,
  ): Promise<Result<MetaUpdateResponse, MetaApiError>> {
    return this.postJson(MetaApiRequestBuilder.fixCampaignUrl(campaignId), {
      objective,
      access_token: accessToken,
    });
  }

  /** AAOS-W1D-S3: `POST /{ad-account}/campaigns` — always `objective: "OUTCOME_LEADS"`, `status: "PAUSED"` for AAOS-created campaigns (`CreateCampaign` use case is the only caller and always passes those). */
  async createCampaign(
    adAccountId: string,
    params: CreateCampaignParams,
    accessToken: string,
  ): Promise<Result<ClientMetaCreateResponse, MetaApiError>> {
    return this.postJsonBody(MetaApiRequestBuilder.createCampaignUrl(adAccountId), {
      name: params.name,
      objective: params.objective,
      special_ad_categories: params.specialAdCategories,
      status: params.status,
      access_token: accessToken,
    });
  }

  /** AAOS-W1D-S3: `POST /{ad-account}/adsets` — always `destination_type: "WHATSAPP"`, `status: "PAUSED"` for AAOS-created ad sets (`CreateCampaign` use case is the only caller and always passes those). */
  async createAdSet(
    adAccountId: string,
    params: CreateAdSetParams,
    accessToken: string,
  ): Promise<Result<ClientMetaCreateResponse, MetaApiError>> {
    return this.postJsonBody(MetaApiRequestBuilder.createAdSetUrl(adAccountId), {
      campaign_id: params.campaignId,
      name: params.name,
      destination_type: params.destinationType,
      optimization_goal: params.optimizationGoal,
      billing_event: params.billingEvent,
      daily_budget: params.dailyBudgetCents,
      status: params.status,
      access_token: accessToken,
    });
  }

  /** AAOS-SIMULASI-TARGETING: `GET /search?type=adinterest&q=<term>` — see `IMetaAdsClient.searchAdInterests`. */
  async searchAdInterests(
    term: string,
    accessToken: string,
  ): Promise<Result<MetaAdInterestSearchResponse, MetaApiError>> {
    const url = MetaApiRequestBuilder.adInterestSearchUrl(term, accessToken);
    return this.getJson(url, MetaAdInterestSearchResponseSchema);
  }

  private async getJson<T>(
    url: string,
    schema: {
      safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: unknown };
    },
  ): Promise<Result<T, MetaApiError>> {
    const responseResult = await this.doFetch(url, { method: "GET" });
    if (!responseResult.ok) {
      return responseResult;
    }
    return this.parseBody(responseResult.value, schema);
  }

  private async postJson<T = MetaUpdateResponse>(
    url: string,
    body: Readonly<Record<string, string | number>>,
  ): Promise<Result<T, MetaApiError>> {
    const responseResult = await this.doFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!responseResult.ok) {
      return responseResult;
    }
    return this.parseBody(
      responseResult.value,
      MetaUpdateResponseSchema as unknown as {
        safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: unknown };
      },
    );
  }

  /**
   * AAOS-W1D-S3: like `postJson`, but for the create-campaign/create-adset bodies, whose
   * `special_ad_categories`/other fields aren't representable in `postJson`'s
   * `Record<string, string | number>` (Meta's JSON body accepts any JSON-compatible value, e.g.
   * an array for `special_ad_categories`). Response is validated against `MetaCreateResponseSchema`
   * (`{ id: string }`) rather than `MetaUpdateResponseSchema`.
   */
  private async postJsonBody(
    url: string,
    body: Readonly<Record<string, string | number | ReadonlyArray<string>>>,
  ): Promise<Result<ClientMetaCreateResponse, MetaApiError>> {
    const responseResult = await this.doFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!responseResult.ok) {
      return responseResult;
    }
    return this.parseBody(responseResult.value, MetaCreateResponseSchema);
  }

  private async doFetch(url: string, init: RequestInit): Promise<Result<Response, MetaApiError>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        return err(await this.toMetaApiError(response));
      }
      return ok(response);
    } catch (cause) {
      return err(
        new ApiServerError(`Meta API network failure: ${describeCause(cause)}`, { cause }),
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseBody<T>(
    response: Response,
    schema: {
      safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: unknown };
    },
  ): Promise<Result<T, MetaApiError>> {
    let json: unknown;
    try {
      json = await response.json();
    } catch (cause) {
      return err(
        new ApiServerError(`Meta API returned a non-JSON response body: ${describeCause(cause)}`, {
          cause,
        }),
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return err(
        new ApiServerError("Meta API response failed schema validation", {
          cause: new ValidationError("Meta API response failed schema validation", {
            context: { zodError: parsed.error },
          }),
        }),
      );
    }
    return ok(parsed.data);
  }

  private async toMetaApiError(response: Response): Promise<MetaApiError> {
    const httpStatus = response.status;
    let metaErrorCode: number | undefined;
    let message = `Meta API request failed with HTTP ${httpStatus}`;
    try {
      const body: unknown = await response.json();
      const parsed = MetaErrorResponseSchema.safeParse(body);
      if (parsed.success) {
        metaErrorCode = parsed.data.error.code;
        message = parsed.data.error.message;
      }
    } catch {
      // Non-JSON error body — fall back to the generic HTTP-status-only message above.
    }

    if (metaErrorCode === META_INVALID_TOKEN_CODE) {
      return new AuthError(message);
    }
    if (metaErrorCode === META_MISSING_PERMISSION_CODE) {
      return new PermissionError(message);
    }
    if (httpStatus === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      return new RateLimitError(message, retryAfterMs);
    }
    if (httpStatus === 401) {
      return new AuthError(message);
    }
    if (httpStatus === 403) {
      return new PermissionError(message);
    }
    if (httpStatus === 500 || httpStatus === 503) {
      return new ApiServerError(message, { context: { httpStatus } });
    }
    return new MetaApiError(message, { httpStatus, metaErrorCode });
  }
}

function parseRetryAfterMs(headerValue: string | null): number {
  if (headerValue === null) {
    return DEFAULT_RETRY_AFTER_MS;
  }
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const asDate = Date.parse(headerValue);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return DEFAULT_RETRY_AFTER_MS;
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
