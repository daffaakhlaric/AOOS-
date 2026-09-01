import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type {
  AddUsersToCustomAudienceParams,
  CreateAdParams,
  CreateAdSetParams,
  CreateAdSetTargeting,
  CreateCampaignParams,
  CreateCustomAudienceParams,
  CreateLookalikeAudienceParams,
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
  MetaAdLocationSearchResponseSchema,
  type MetaAdLocationSearchResponse,
  MetaAdSetListResponseSchema,
  type MetaAdSetListResponse,
  MetaCampaignListResponseSchema,
  type MetaCampaignListResponse,
  MetaCreateResponseSchema,
  MetaCustomAudienceCreateResponseSchema,
  type MetaCustomAudienceCreateResponse,
  MetaCustomAudienceUsersResponseSchema,
  type MetaCustomAudienceUsersResponse,
  MetaErrorResponseSchema,
  MetaImageUploadResponseSchema,
  type MetaImageUploadResponse,
  MetaUpdateResponseSchema,
  type MetaUpdateResponse,
  MetaVideoUploadResponseSchema,
  type MetaVideoUploadResponse,
} from "../../types/MetaApiTypes.js";

import { MetaApiRequestBuilder } from "./MetaApiRequestBuilder.js";

const META_INVALID_TOKEN_CODE = 190;
const META_MISSING_PERMISSION_CODE = 200;
const DEFAULT_RETRY_AFTER_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * AAOS EPIC S, Phase S1 — Meta's real `special_ad_category` values that enforce a HARD ERROR
 * (code `2909035`) on non-default age/gender targeting. Verified 2026-09-01 against Meta's
 * Marketing API "Special Ad Category" guide (developers.facebook.com/docs/marketing-api/
 * special-ad-category). `HOUSING` is the only one this codebase's `PropertyBranchAudienceDefaults`
 * currently produces, but all three are real Meta categories with the identical restriction.
 */
const AGE_GENDER_RESTRICTED_SPECIAL_AD_CATEGORIES = new Set([
  "HOUSING",
  "EMPLOYMENT",
  "FINANCIAL_PRODUCTS_SERVICES",
]);

/**
 * AAOS EPIC S, Phase S1 — translates `CreateAdSetTargeting`'s camelCase shape into Meta's real
 * wire `targeting` object. `age_min`/`age_max`/`genders` are omitted entirely (never sent) when
 * `specialAdCategories` includes one of `AGE_GENDER_RESTRICTED_SPECIAL_AD_CATEGORIES` — see
 * `CreateAdSetParams.specialAdCategories`'s own doc for why. `geo_locations` is unaffected by that
 * restriction and is always included when supplied.
 */
function serializeTargeting(
  targeting: CreateAdSetTargeting,
  specialAdCategories: ReadonlyArray<string> | undefined,
): Record<string, unknown> {
  const restrictsAgeGender = (specialAdCategories ?? []).some((category) =>
    AGE_GENDER_RESTRICTED_SPECIAL_AD_CATEGORIES.has(category),
  );
  const wire: Record<string, unknown> = {};
  if (targeting.geoLocations !== undefined) {
    wire.geo_locations = {
      cities: targeting.geoLocations.cities.map((city) => ({
        key: city.key,
        ...(city.radius !== undefined ? { radius: city.radius } : {}),
        ...(city.distanceUnit !== undefined ? { distance_unit: city.distanceUnit } : {}),
      })),
    };
  }
  if (!restrictsAgeGender) {
    if (targeting.ageMin !== undefined) {
      wire.age_min = targeting.ageMin;
    }
    if (targeting.ageMax !== undefined) {
      wire.age_max = targeting.ageMax;
    }
    if (targeting.genders !== undefined) {
      wire.genders = targeting.genders;
    }
  }
  return wire;
}

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

  /**
   * AAOS-W1D-S3: `POST /{ad-account}/adsets` — always `destination_type: "WHATSAPP"`,
   * `status: "PAUSED"` for AAOS-created ad sets (`CreateCampaign` use case is the only caller and
   * always passes those). AAOS EPIC S, Phase S1: `targeting` is included ONLY when
   * `params.targeting` is supplied — omitted entirely otherwise, so every existing AUTOMOTIVE call
   * site (which never supplies it) sends byte-for-byte the same body as before this field existed.
   */
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
      ...(params.targeting !== undefined
        ? { targeting: serializeTargeting(params.targeting, params.specialAdCategories) }
        : {}),
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

  /** AAOS EPIC S, Phase S2: `GET /search?type=adgeolocation&location_types=["city"]&q=<query>` — see `IMetaAdsClient.searchAdLocations`. */
  async searchAdLocations(
    query: string,
    locationType: "city",
    accessToken: string,
  ): Promise<Result<MetaAdLocationSearchResponse, MetaApiError>> {
    const url = MetaApiRequestBuilder.adLocationSearchUrl(query, locationType, accessToken);
    return this.getJson(url, MetaAdLocationSearchResponseSchema);
  }

  /** AAOS-GO-LIVE: `POST /{campaign-id}` with `status: "PAUSED"` — see `IMetaAdsClient.pauseCampaign`. */
  async pauseCampaign(
    campaignId: string,
    accessToken: string,
  ): Promise<Result<MetaUpdateResponse, MetaApiError>> {
    return this.postJson(MetaApiRequestBuilder.pauseCampaignUrl(campaignId), {
      status: "PAUSED",
      access_token: accessToken,
    });
  }

  /** AAOS-GO-LIVE: `POST /{campaign-id}` with `status: "ACTIVE"` — see `IMetaAdsClient.activateCampaign`. */
  async activateCampaign(
    campaignId: string,
    accessToken: string,
  ): Promise<Result<MetaUpdateResponse, MetaApiError>> {
    return this.postJson(MetaApiRequestBuilder.activateCampaignUrl(campaignId), {
      status: "ACTIVE",
      access_token: accessToken,
    });
  }

  /** AAOS-GO-LIVE: `POST /{ad-id}` with `status: "ACTIVE"` — see `IMetaAdsClient.activateAd`. */
  async activateAd(
    adId: string,
    accessToken: string,
  ): Promise<Result<MetaUpdateResponse, MetaApiError>> {
    return this.postJson(MetaApiRequestBuilder.activateAdUrl(adId), {
      status: "ACTIVE",
      access_token: accessToken,
    });
  }

  /**
   * AAOS-GO-LIVE: `POST /{ad-account}/ads` — see `IMetaAdsClient.createAd`. Builds the real
   * `object_story_spec` shape Meta expects: `video_data` for a video creative, `link_data` for an
   * image creative, both carrying the CTWA `call_to_action`.
   */
  async createAd(
    adAccountId: string,
    params: CreateAdParams,
    accessToken: string,
  ): Promise<Result<ClientMetaCreateResponse, MetaApiError>> {
    const objectStorySpec =
      params.creative.kind === "VIDEO"
        ? {
            page_id: params.pageId,
            video_data: {
              video_id: params.creative.videoId,
              image_url: params.creative.thumbnailUrl,
              message: params.creative.message,
              call_to_action: { type: params.creative.callToActionType },
            },
          }
        : {
            page_id: params.pageId,
            link_data: {
              image_hash: params.creative.imageHash,
              link: params.creative.linkUrl,
              message: params.creative.message,
              call_to_action: { type: params.creative.callToActionType },
            },
          };
    const responseResult = await this.doFetch(MetaApiRequestBuilder.createAdUrl(adAccountId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        adset_id: params.adSetId,
        name: params.name,
        creative: { object_story_spec: objectStorySpec },
        status: params.status,
        access_token: accessToken,
      }),
    });
    if (!responseResult.ok) {
      return responseResult;
    }
    return this.parseBody(responseResult.value, MetaCreateResponseSchema);
  }

  /** AAOS-GO-LIVE: `POST /{ad-account}/advideos` with `file_url` — see `IMetaAdsClient.uploadVideo`. */
  async uploadVideo(
    adAccountId: string,
    videoUrl: string,
    accessToken: string,
  ): Promise<Result<MetaVideoUploadResponse, MetaApiError>> {
    const responseResult = await this.doFetch(MetaApiRequestBuilder.uploadVideoUrl(adAccountId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file_url: videoUrl, access_token: accessToken }),
    });
    if (!responseResult.ok) {
      return responseResult;
    }
    return this.parseBody(responseResult.value, MetaVideoUploadResponseSchema);
  }

  /** AAOS-GO-LIVE: `POST /{ad-account}/adimages` with `url` — see `IMetaAdsClient.uploadImage`. */
  async uploadImage(
    adAccountId: string,
    imageUrl: string,
    accessToken: string,
  ): Promise<Result<MetaImageUploadResponse, MetaApiError>> {
    const responseResult = await this.doFetch(MetaApiRequestBuilder.uploadImageUrl(adAccountId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: imageUrl, access_token: accessToken }),
    });
    if (!responseResult.ok) {
      return responseResult;
    }
    return this.parseBody(responseResult.value, MetaImageUploadResponseSchema);
  }

  /**
   * AAOS-ABTESTING-LOOKALIKE Part 2: `POST /act_{ad-account-id}/customaudiences` with
   * `subtype: "CUSTOM"` — see `IMetaAdsClient.createCustomAudience`.
   */
  async createCustomAudience(
    adAccountId: string,
    params: CreateCustomAudienceParams,
    accessToken: string,
  ): Promise<Result<MetaCustomAudienceCreateResponse, MetaApiError>> {
    const responseResult = await this.doFetch(
      MetaApiRequestBuilder.createCustomAudienceUrl(adAccountId),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: params.name,
          subtype: params.subtype,
          ...(params.description !== undefined ? { description: params.description } : {}),
          customer_file_source: params.customerFileSource,
          access_token: accessToken,
        }),
      },
    );
    if (!responseResult.ok) {
      return responseResult;
    }
    return this.parseBody(responseResult.value, MetaCustomAudienceCreateResponseSchema);
  }

  /**
   * AAOS-ABTESTING-LOOKALIKE Part 2: `POST /{custom-audience-id}/users` with
   * `payload: {schema: ["PHONE"], data: [[hash], ...]}` — see
   * `IMetaAdsClient.addUsersToCustomAudience`. Verified 2026-08-21: Meta's real `schema` literal
   * for phone data is `"PHONE"`, not `"PHONE_SHA256"` — the value must already be SHA256-hashed
   * before it reaches this call, but the schema token itself stays `"PHONE"`.
   */
  async addUsersToCustomAudience(
    customAudienceId: string,
    params: AddUsersToCustomAudienceParams,
    accessToken: string,
  ): Promise<Result<MetaCustomAudienceUsersResponse, MetaApiError>> {
    const responseResult = await this.doFetch(
      MetaApiRequestBuilder.customAudienceUsersUrl(customAudienceId),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payload: {
            schema: ["PHONE"],
            data: params.hashedPhones.map((hash) => [hash]),
          },
          access_token: accessToken,
        }),
      },
    );
    if (!responseResult.ok) {
      return responseResult;
    }
    return this.parseBody(responseResult.value, MetaCustomAudienceUsersResponseSchema);
  }

  /**
   * AAOS-ABTESTING-LOOKALIKE Part 2: `POST /act_{ad-account-id}/customaudiences` with
   * `subtype: "LOOKALIKE"` and a `lookalike_spec` — see `IMetaAdsClient.createLookalikeAudience`.
   */
  async createLookalikeAudience(
    adAccountId: string,
    params: CreateLookalikeAudienceParams,
    accessToken: string,
  ): Promise<Result<MetaCustomAudienceCreateResponse, MetaApiError>> {
    const responseResult = await this.doFetch(
      MetaApiRequestBuilder.createCustomAudienceUrl(adAccountId),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: params.name,
          subtype: "LOOKALIKE",
          origin_audience_id: params.originAudienceId,
          lookalike_spec: JSON.stringify({
            type: "similarity",
            ratio: params.ratio,
            country: params.country,
          }),
          access_token: accessToken,
        }),
      },
    );
    if (!responseResult.ok) {
      return responseResult;
    }
    return this.parseBody(responseResult.value, MetaCustomAudienceCreateResponseSchema);
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
    body: Readonly<
      Record<string, string | number | ReadonlyArray<string> | Record<string, unknown>>
    >,
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
