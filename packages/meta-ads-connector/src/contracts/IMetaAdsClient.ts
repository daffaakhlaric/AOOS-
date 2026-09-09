import type { Result } from "@aos/common";

import type { MetaApiError } from "../domain/errors/index.js";
import type {
  MetaAdAccountResponse,
  MetaAdInterestSearchResponse,
  MetaAdListResponse,
  MetaAdLocationSearchResponse,
  MetaAdSetListResponse,
  MetaCampaignExpandedListResponse,
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

/**
 * Meta's real `targeting.geo_locations.cities[]` entry — verified 2026-09-01 against Meta's
 * Marketing API "Basic Targeting" reference (developers.facebook.com/docs/marketing-api/audiences/
 * reference/basic-targeting/): `key` is the city identifier returned by the real
 * `GET /search?type=adgeolocation` endpoint (Meta's "Targeting Search" reference — see
 * `SearchAdInterests.ts`'s sibling geo-search use case, S2, for the analogous read path), `radius`
 * is 10-50 (mile) or 17-80 (kilometer), and up to 250 cities are accepted per targeting spec.
 */
export interface MetaTargetingCity {
  readonly key: string;
  readonly radius?: number;
  readonly distanceUnit?: "mile" | "kilometer";
}

/**
 * Input for `IMetaAdsClient.createAdSet`'s optional `targeting` field (AAOS EPIC S, Phase S1) —
 * mirrors Meta's real Ad Set `targeting` object shape, verified 2026-09-01 against Meta's
 * Marketing API "Basic Targeting" reference: `age_min`/`age_max` are ints (13-65, default 18/
 * no-max), `genders` is an array of ints (`1` = male, `2` = female; omit for Meta's "all genders"
 * default), `geo_locations.cities[].key` is a Meta-issued city id (see `MetaTargetingCity`).
 * Optional/additive on `CreateAdSetParams` — see that field's own doc for the zero-regression
 * guarantee.
 */
export interface CreateAdSetTargeting {
  readonly geoLocations?: {
    readonly cities: ReadonlyArray<MetaTargetingCity>;
  };
  readonly ageMin?: number;
  readonly ageMax?: number;
  /** `1` = male, `2` = female. Omit (or leave empty) for Meta's "all genders" default. */
  readonly genders?: ReadonlyArray<1 | 2>;
}

/** Input for `IMetaAdsClient.createAdSet` (AAOS-W1D-S3) — mirrors Meta's `POST /{ad-account}/adsets` body shape. */
export interface CreateAdSetParams {
  readonly campaignId: string;
  readonly name: string;
  /** Always `"WHATSAPP"` for AAOS-created ad sets (CTWA — lead lands in WhatsApp with Clara). */
  readonly destinationType: string;
  readonly optimizationGoal: string;
  readonly billingEvent: string;
  readonly dailyBudgetCents: number;
  /** Always `"PAUSED"` — DSS approves before activating. */
  readonly status: string;
  /**
   * AAOS EPIC S, Phase S1 — optional/additive real Meta `targeting` object. **Omitted here means
   * `createAdSet` sends no `targeting` field to Meta at all** — every existing AUTOMOTIVE call
   * site (Meta's own default/broad targeting) keeps behaving byte-for-byte as before this field
   * was added.
   */
  readonly targeting?: CreateAdSetTargeting;
  /**
   * AAOS EPIC S, Phase S1 — denormalized copy of the parent campaign's real
   * `special_ad_categories` (Meta's AdSet endpoint itself does not accept this field — it is
   * inherited from the campaign — but the wire client needs to know it here). Verified 2026-09-01
   * against Meta's Marketing API "Special Ad Category" guide
   * (developers.facebook.com/docs/marketing-api/special-ad-category): when `HOUSING`,
   * `EMPLOYMENT`, or `FINANCIAL_PRODUCTS_SERVICES` is present, Meta's real API enforces a HARD
   * ERROR (code `2909035`, "Custom Age/Gender Selection Is Not Available") on any non-default
   * `age_min`/`age_max`/`genders` — so the wire client omits those three `targeting` sub-fields
   * entirely rather than risk the rejection (`geo_locations` is unaffected and still sent).
   * Optional; omitted (or `[]`) means `age_min`/`age_max`/`genders` are sent exactly as supplied,
   * unchanged from today.
   */
  readonly specialAdCategories?: ReadonlyArray<string>;
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
  /**
   * AAOS-SAMANTHA-LLM-AD-COPY — optional real Meta `video_data.link_description` field (verified
   * against Meta's Marketing API "Ad Creative" reference: `video_data` accepts the same
   * `link_description` sibling field `link_data` accepts as `description`). Additive/optional —
   * every pre-existing caller (e.g. `GoLiveService`, which sends only `message`) omits this and the
   * wire payload is byte-for-byte unchanged.
   */
  readonly description?: string;
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
  /**
   * AAOS-SAMANTHA-LLM-AD-COPY — optional real Meta `link_data.description` field, verified against
   * Meta's Marketing API "Ad Creative" reference (developers.facebook.com/docs/marketing-api/
   * reference/ad-creative-link-data): `link_data.description` is the real, Meta-supported field for
   * an image/link ad's secondary descriptive text. Additive/optional — every pre-existing caller
   * (e.g. `GoLiveService`, which sends only `message`) omits this and the wire payload is
   * byte-for-byte unchanged.
   */
  readonly description?: string;
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

  /**
   * N+1-fanout fix (real, currently-broken-in-production "User request limit reached" incident) —
   * `PullCampaignData`'s new primary campaign-tree pull. A single Meta Graph API call using real,
   * documented nested-field-expansion + `.limit(N)`-on-nested-edge syntax
   * (`campaigns?fields=...,adsets.limit(N){...,ads.limit(M){...}}`) that returns the WHOLE
   * campaign→adset→ad hierarchy (each level's own `insights` inline) instead of the old
   * `getCampaigns` + per-campaign `getAdSets` + per-adset `getAds` fanout — see
   * `MetaApiRequestBuilder.campaignsExpandedUrl`'s own docstring for the exact real request shape.
   * `getCampaigns`/`getAdSets`/`getAds` above are all kept, unmodified — `PullCampaignData` still
   * uses them as the real, honest per-campaign/per-adset fallback when a nested edge's own
   * `paging.next` shows it overflowed this call's `.limit(N)` page size (see
   * `types/MetaApiTypes.ts`'s `MetaCampaignExpandedSchema` doc).
   */
  getCampaignsExpanded(
    adAccountId: string,
    accessToken: string,
    datePreset: string,
    cursor?: PageCursor,
  ): Promise<Result<MetaCampaignExpandedListResponse, MetaApiError>>;

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
   * AAOS EPIC S, Phase S2: `GET /search?type=adgeolocation&location_types=["city"]&q=<query>` —
   * Meta's real location-search endpoint (verified 2026-09-01 against Meta's Marketing API
   * "Targeting Search" reference — see `SearchAdLocations`'s own docstring for the full citation
   * and no-match/ambiguous-match behavior). A pure READ against the same ad-account-independent
   * search node `searchAdInterests` uses. Nothing about this call creates, modifies, or targets a
   * real campaign — it only resolves a free-text city name to Meta's own `key` id for later use in
   * `CreateAdSetTargeting.geoLocations` (a later phase, not this one).
   */
  searchAdLocations(
    query: string,
    locationType: "city",
    accessToken: string,
  ): Promise<Result<MetaAdLocationSearchResponse, MetaApiError>>;

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
   * honestly re-activate an ad that a Samantha PAUSE verdict paused during Go Live's verdict
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
