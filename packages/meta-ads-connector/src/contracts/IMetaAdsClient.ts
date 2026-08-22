import type { Result } from "@aos/common";

import type { MetaApiError } from "../domain/errors/index.js";
import type {
  MetaAdAccountResponse,
  MetaAdInterestSearchResponse,
  MetaAdListResponse,
  MetaAdSetListResponse,
  MetaCampaignListResponse,
  MetaCustomAudienceCreateResponse,
  MetaCustomAudienceUsersResponse,
  MetaImageUploadResponse,
  MetaUpdateResponse,
  MetaVideoUploadResponse,
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

/** Result of `createCampaign`/`createAdSet`/`createAd` — Meta's `POST /{ad-account}/campaigns|adsets|ads` response always includes the new object's `id`. */
export interface MetaCreateResponse {
  readonly id: string;
}

/**
 * Input for `IMetaAdsClient.createAd` (AAOS-GO-LIVE) — mirrors Meta's real
 * `object_story_spec.video_data` shape for a click-to-WhatsApp video ad. `videoId` is the id
 * returned by a prior `uploadVideo` call.
 */
export interface CreateAdCreativeVideoSpec {
  readonly kind: "VIDEO";
  readonly videoId: string;
  /** Meta requires a thumbnail image URL for video creatives (`image_url` under `video_data`). */
  readonly thumbnailUrl: string;
  readonly message: string;
  /** e.g. `"WHATSAPP_MESSAGE"` — CTWA's real call-to-action type. */
  readonly callToActionType: string;
}

/**
 * Input for `IMetaAdsClient.createAd` (AAOS-GO-LIVE) — mirrors Meta's real
 * `object_story_spec.link_data` shape for a click-to-WhatsApp image ad. `imageHash` is the hash
 * returned by a prior `uploadImage` call.
 */
export interface CreateAdCreativeImageSpec {
  readonly kind: "IMAGE";
  readonly imageHash: string;
  readonly linkUrl: string;
  readonly message: string;
  /** e.g. `"WHATSAPP_MESSAGE"` — CTWA's real call-to-action type. */
  readonly callToActionType: string;
}

export type CreateAdCreativeSpec = CreateAdCreativeVideoSpec | CreateAdCreativeImageSpec;

/**
 * Input for `IMetaAdsClient.createCustomAudience` (AAOS-ABTESTING-LOOKALIKE Part 2) — mirrors
 * Meta's real `POST /act_{ad-account-id}/customaudiences` body shape for a `subtype: "CUSTOM"`
 * hot-leads audience. Verified 2026-08-21 against Meta's Marketing API "Custom Audiences" guide.
 */
export interface CreateCustomAudienceParams {
  readonly name: string;
  readonly description?: string;
  /** Always `"CUSTOM"` here — Lookalikes are created via `createLookalikeAudience` instead. */
  readonly subtype: "CUSTOM";
  readonly customerFileSource:
    "USER_PROVIDED_ONLY" | "PARTNER_PROVIDED_ONLY" | "BOTH_USER_AND_PARTNER_PROVIDED";
}

/**
 * Input for `IMetaAdsClient.addUsersToCustomAudience` (AAOS-ABTESTING-LOOKALIKE Part 2) — mirrors
 * Meta's real `POST /{custom-audience-id}/users` body shape. `hashedPhones` are already
 * SHA256-hashed, normalized (no leading `+`, no symbols) phone numbers — hashing happens in the
 * `SyncHotLeadsToCustomAudience` use case, not here; this method is a thin, already-hashed upload.
 */
export interface AddUsersToCustomAudienceParams {
  readonly hashedPhones: ReadonlyArray<string>;
}

/**
 * Input for `IMetaAdsClient.createLookalikeAudience` (AAOS-ABTESTING-LOOKALIKE Part 2) — mirrors
 * Meta's real `POST /act_{ad-account-id}/customaudiences` body shape for a `subtype: "LOOKALIKE"`
 * audience, whose `lookalike_spec` carries `{type: "similarity", ratio, country}`. Verified
 * 2026-08-21 against Meta's Marketing API "Lookalike Audiences" guide — Lookalikes are NOT a
 * separate endpoint from Custom Audience creation, contrary to the spec's imagined
 * `createLookalikeAudience` Graph API method name.
 */
export interface CreateLookalikeAudienceParams {
  readonly name: string;
  readonly originAudienceId: string;
  /** e.g. `0.01` for 1%, `0.02` for 2%, `0.03` for 3% — Meta's real `ratio` range is 0.01-0.20. */
  readonly ratio: number;
  /** ISO 3166-1 alpha-2 country code, e.g. `"ID"`. */
  readonly country: string;
}

/** Input for `IMetaAdsClient.createAd` (AAOS-GO-LIVE) — mirrors Meta's `POST /{ad-account}/ads` body shape. */
export interface CreateAdParams {
  readonly adSetId: string;
  readonly name: string;
  /** The tenant's Facebook Page id — required by `object_story_spec.page_id` for any ad creative. */
  readonly pageId: string;
  readonly creative: CreateAdCreativeSpec;
  /** `"ACTIVE"` for Go Live-created ads (the simulation is already DSS-approved by the time this runs), `"PAUSED"` otherwise. */
  readonly status: string;
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

  /**
   * AAOS-SIMULASI-TARGETING: `GET /search?type=adinterest&q=<term>` — Meta's real ad-interest
   * targeting search. A pure READ against an ad-account-independent search node (no ad account id
   * involved), used by `SearchAdInterests` to discover real interest ids/names/audience sizes.
   * Nothing about this call creates, modifies, or targets a real campaign.
   */
  searchAdInterests(
    term: string,
    accessToken: string,
  ): Promise<Result<MetaAdInterestSearchResponse, MetaApiError>>;

  /**
   * AAOS-GO-LIVE: `POST /{campaign-id}` with `status: "PAUSED"` — pauses a campaign. Unlike
   * `pauseAd` (ad-level), this targets the campaign node directly; used by Go Live's rollback to
   * pause the campaign it just created.
   */
  pauseCampaign(
    campaignId: string,
    accessToken: string,
  ): Promise<Result<MetaUpdateResponse, MetaApiError>>;

  /** AAOS-GO-LIVE: `POST /{campaign-id}` with `status: "ACTIVE"` — activates a campaign (e.g. the newly-created Go Live campaign, after its ad set + ad are ready). */
  activateCampaign(
    campaignId: string,
    accessToken: string,
  ): Promise<Result<MetaUpdateResponse, MetaApiError>>;

  /**
   * AAOS-GO-LIVE: `POST /{ad-id}` with `status: "ACTIVE"` — the inverse of the existing `pauseAd`.
   * Added alongside `pauseCampaign`/`activateCampaign` specifically so Go Live's rollback can
   * honestly re-activate an ad that a Tamara PAUSE verdict paused during Go Live's verdict
   * execution step (rollback needs a real way to undo that, not just campaign-level undo).
   */
  activateAd(adId: string, accessToken: string): Promise<Result<MetaUpdateResponse, MetaApiError>>;

  /** AAOS-GO-LIVE: `POST /{ad-account}/ads` — creates a single ad under an existing ad set, with a video or image creative attached, per `CreateAdParams`. */
  createAd(
    adAccountId: string,
    params: CreateAdParams,
    accessToken: string,
  ): Promise<Result<MetaCreateResponse, MetaApiError>>;

  /**
   * AAOS-GO-LIVE: `POST /{ad-account}/advideos` with `file_url` — uploads an already-hosted (GCS)
   * video into the ad account's asset library, returning a real Meta video id usable in
   * `createAd`'s `video_data.video_id`.
   */
  uploadVideo(
    adAccountId: string,
    videoUrl: string,
    accessToken: string,
  ): Promise<Result<MetaVideoUploadResponse, MetaApiError>>;

  /**
   * AAOS-GO-LIVE: `POST /{ad-account}/adimages` with `url` — uploads an already-hosted (GCS)
   * image into the ad account's asset library, returning a real Meta image hash usable in
   * `createAd`'s `link_data.image_hash`.
   */
  uploadImage(
    adAccountId: string,
    imageUrl: string,
    accessToken: string,
  ): Promise<Result<MetaImageUploadResponse, MetaApiError>>;

  /**
   * AAOS-ABTESTING-LOOKALIKE Part 2: `POST /act_{ad-account-id}/customaudiences` with
   * `subtype: "CUSTOM"` — creates a new, empty Custom Audience (e.g. the tenant's hot-leads
   * audience). Verified 2026-08-21 against Meta's Marketing API "Custom Audiences" guide.
   */
  createCustomAudience(
    adAccountId: string,
    params: CreateCustomAudienceParams,
    accessToken: string,
  ): Promise<Result<MetaCustomAudienceCreateResponse, MetaApiError>>;

  /**
   * AAOS-ABTESTING-LOOKALIKE Part 2: `POST /{custom-audience-id}/users` — uploads already-hashed
   * phone numbers into an existing Custom Audience (`payload.schema: ["PHONE"]`). Verified
   * 2026-08-21 against Meta's Marketing API "Custom Audiences" guide.
   */
  addUsersToCustomAudience(
    customAudienceId: string,
    params: AddUsersToCustomAudienceParams,
    accessToken: string,
  ): Promise<Result<MetaCustomAudienceUsersResponse, MetaApiError>>;

  /**
   * AAOS-ABTESTING-LOOKALIKE Part 2: `POST /act_{ad-account-id}/customaudiences` with
   * `subtype: "LOOKALIKE"` and a `lookalike_spec` — creates a Lookalike Audience seeded from an
   * existing Custom Audience. Verified 2026-08-21 against Meta's Marketing API "Lookalike
   * Audiences" guide — same endpoint as `createCustomAudience`, not a separate Graph API call.
   */
  createLookalikeAudience(
    adAccountId: string,
    params: CreateLookalikeAudienceParams,
    accessToken: string,
  ): Promise<Result<MetaCustomAudienceCreateResponse, MetaApiError>>;
}
