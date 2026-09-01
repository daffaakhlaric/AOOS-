import type { PageCursor } from "../../contracts/IMetaAdsClient.js";

const API_VERSION = "v21.0";
const BASE_URL = "https://graph.facebook.com";

/** `created_time` is requested beyond the spec's literal field list — see `mappers/CampaignMapper.ts`'s docstring for why. */
const CAMPAIGN_FIELDS = ["id", "name", "objective", "status", "created_time"].join(",");

/**
 * `targeting` added for AAOS Analytics Platform Phase 3's real AdSet-targeting scope extension.
 * Requested BARE (no `field{subfields}` expansion) — unlike `creative` below, `targeting` is a
 * plain JSON object field on the AdSet node, not an edge, so Meta already returns it in full; see
 * `types/MetaApiTypes.ts`'s `MetaAdSetTargetingSchema` docstring for the verified real shape and
 * its one honest, documented gap (`custom_audiences[]` carries no `subtype`).
 */
const ADSET_FIELDS = ["id", "name", "status", "daily_budget", "targeting"].join(",");

/**
 * `creative{image_hash,video_id}` — Meta's real nested-field-expansion syntax for pulling a
 * connected/child object's own fields inline on the parent read, same `field{subfield,...}`
 * grammar this file's own `insightsExpansion` already relies on for `insights.date_preset(...){...}`
 * (Meta Graph API "Field Expansion" convention). Verified against Meta's Marketing API "Ad"
 * reference: `creative` is a real field on the `Ad` node, and `image_hash`/`video_id` are real
 * fields on the `AdCreative` node it expands to (AAOS Analytics Platform Phase 2, "Asset-First
 * Analytics" — these two fields were previously only ever WRITE-side, in `MetaApiClient`'s
 * `createAd` creative-spec payload; this is the first READ-side pull of them).
 */
const AD_FIELDS = ["id", "name", "status", "created_time", "creative{image_hash,video_id}"].join(
  ",",
);

/**
 * `messaging_conversation_started` was removed from this list — it is not a valid top-level
 * Insights `fields` param (Meta rejects it: `"(#100) messaging_conversation_started is not
 * valid for fields param"`). The real data comes back nested inside `actions[]` as
 * `action_type: "onsite_conversion.total_messaging_connection"` / `"...messaging_conversation_
 * started_7d"`, which `actions` (already in this list) already requests — see
 * `utils/D3Calculator.ts`. `D3Calculator.calculateActionBreakdown`'s `messagingConversationStarted`
 * fallback parameter (for when the `total_messaging_connection` action row is absent) is now
 * permanently unreachable as a result — it degrades to reporting 0 conversations in that edge
 * case instead of a fallback value, rather than throwing. Left in place rather than removed
 * here since narrowing that logic is a separate, deliberate follow-up, not implied by "remove
 * this field from the fields list."
 */
const INSIGHTS_METRIC_FIELDS = "spend,impressions,reach,frequency,clicks,actions";

function insightsExpansion(datePreset: string, fields: string): string {
  return `insights.date_preset(${datePreset}){${fields}}`;
}

/** Pure, side-effect-free URL builders for the Meta Marketing Graph API — no `fetch` here, so they're trivially unit-testable and reusable by `MetaApiClient`. */
export class MetaApiRequestBuilder {
  static campaignsUrl(
    adAccountId: string,
    accessToken: string,
    datePreset: string,
    cursor?: PageCursor,
  ): string {
    const fields = `${CAMPAIGN_FIELDS},${insightsExpansion(datePreset, INSIGHTS_METRIC_FIELDS)}`;
    return MetaApiRequestBuilder.buildGetUrl(
      `${adAccountId}/campaigns`,
      accessToken,
      fields,
      cursor,
    );
  }

  static adSetsUrl(campaignId: string, accessToken: string, cursor?: PageCursor): string {
    const fields = `${ADSET_FIELDS},${insightsExpansion("last_30d", "spend")}`;
    return MetaApiRequestBuilder.buildGetUrl(`${campaignId}/adsets`, accessToken, fields, cursor);
  }

  static adsUrl(
    adSetId: string,
    accessToken: string,
    datePreset: string,
    cursor?: PageCursor,
  ): string {
    const fields = `${AD_FIELDS},${insightsExpansion(datePreset, INSIGHTS_METRIC_FIELDS)}`;
    return MetaApiRequestBuilder.buildGetUrl(`${adSetId}/ads`, accessToken, fields, cursor);
  }

  /**
   * `GET /{ad_account_id}?fields=name` — the lightweight name lookup for the multi-account
   * selector (coordinator note #6 on `docs/PROMPT-AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE.md`).
   * Intentionally the ONLY field requested (no `insights` expansion, no campaign fields) — this
   * is called once per configured ad account to build a picker, not to pull performance data.
   */
  static adAccountUrl(adAccountId: string, accessToken: string): string {
    const url = new URL(`${BASE_URL}/${API_VERSION}/${adAccountId}`);
    url.searchParams.set("fields", "name");
    url.searchParams.set("access_token", accessToken);
    return url.toString();
  }

  static pauseAdUrl(adId: string): string {
    return `${BASE_URL}/${API_VERSION}/${adId}`;
  }

  static scaleAdSetUrl(adSetId: string): string {
    return `${BASE_URL}/${API_VERSION}/${adSetId}`;
  }

  static fixCampaignUrl(campaignId: string): string {
    return `${BASE_URL}/${API_VERSION}/${campaignId}`;
  }

  /** AAOS-W1D-S3: `POST /{ad-account}/campaigns` — create a new campaign. */
  static createCampaignUrl(adAccountId: string): string {
    return `${BASE_URL}/${API_VERSION}/${adAccountId}/campaigns`;
  }

  /** AAOS-W1D-S3: `POST /{ad-account}/adsets` — create a new ad set. */
  static createAdSetUrl(adAccountId: string): string {
    return `${BASE_URL}/${API_VERSION}/${adAccountId}/adsets`;
  }

  /**
   * AAOS-SIMULASI-TARGETING: `GET /search?type=adinterest&q=<term>` — Meta's real ad-interest
   * targeting-search endpoint (confirmed live 2026-08-18). Deliberately built with the EXACT
   * three params the confirmed-live call used (`type`, `q`, `access_token`) and no `limit`/`fields`
   * of its own: this endpoint is not documented to accept the same paging params the
   * `/{node}/edge` reads above use, and the result set is already small. Capping how many rows
   * AAOS keeps is `SearchAdInterests`'s job, not this URL's.
   */
  /** AAOS-GO-LIVE: `POST /{campaign-id}` — pause/activate a campaign (same node URL as `fixCampaignUrl`, kept as its own named method for call-site clarity). */
  static pauseCampaignUrl(campaignId: string): string {
    return `${BASE_URL}/${API_VERSION}/${campaignId}`;
  }

  /** AAOS-GO-LIVE: `POST /{campaign-id}` — see `pauseCampaignUrl`. */
  static activateCampaignUrl(campaignId: string): string {
    return `${BASE_URL}/${API_VERSION}/${campaignId}`;
  }

  /** AAOS-GO-LIVE: `POST /{ad-id}` — the inverse of `pauseAdUrl`. */
  static activateAdUrl(adId: string): string {
    return `${BASE_URL}/${API_VERSION}/${adId}`;
  }

  /** AAOS-GO-LIVE: `POST /{ad-account}/ads` — create a single ad. */
  static createAdUrl(adAccountId: string): string {
    return `${BASE_URL}/${API_VERSION}/${adAccountId}/ads`;
  }

  /** AAOS-GO-LIVE: `POST /{ad-account}/advideos` — Meta's real video-upload endpoint. */
  static uploadVideoUrl(adAccountId: string): string {
    return `${BASE_URL}/${API_VERSION}/${adAccountId}/advideos`;
  }

  /** AAOS-GO-LIVE: `POST /{ad-account}/adimages` — Meta's real image-upload endpoint. */
  static uploadImageUrl(adAccountId: string): string {
    return `${BASE_URL}/${API_VERSION}/${adAccountId}/adimages`;
  }

  /**
   * AAOS-ABTESTING-LOOKALIKE Part 2: `POST /act_{ad-account-id}/customaudiences` — creates a
   * Custom Audience (`subtype: "CUSTOM"`) or a Lookalike Audience (`subtype: "LOOKALIKE"`), both
   * on this same node URL — verified 2026-08-21 against Meta's Marketing API docs.
   */
  static createCustomAudienceUrl(adAccountId: string): string {
    return `${BASE_URL}/${API_VERSION}/${adAccountId}/customaudiences`;
  }

  /** AAOS-ABTESTING-LOOKALIKE Part 2: `POST /{custom-audience-id}/users` — Meta's real hashed-user upload endpoint. */
  static customAudienceUsersUrl(customAudienceId: string): string {
    return `${BASE_URL}/${API_VERSION}/${customAudienceId}/users`;
  }

  static adInterestSearchUrl(term: string, accessToken: string): string {
    const url = new URL(`${BASE_URL}/${API_VERSION}/search`);
    url.searchParams.set("type", "adinterest");
    url.searchParams.set("q", term);
    url.searchParams.set("access_token", accessToken);
    return url.toString();
  }

  /**
   * AAOS EPIC S, Phase S2: `GET /search?type=adgeolocation&location_types=["city"]&q=<query>` —
   * Meta's real location-search endpoint (verified 2026-09-01 against Meta's Marketing API
   * "Targeting Search" reference, developers.facebook.com/docs/marketing-api/audiences/reference/
   * targeting-search — see `SearchAdLocations`'s own docstring for the full citation). Mirrors
   * `adInterestSearchUrl` above: the exact params the docs specify (`type`, `location_types`,
   * `q`, `access_token`) and nothing else — no `limit`/`fields` of its own, no paging assumed.
   * `location_types` is passed as a JSON-array-shaped string per the docs' own example
   * (`location_types=["city"]`), not a bare/comma-joined value.
   */
  static adLocationSearchUrl(query: string, locationType: "city", accessToken: string): string {
    const url = new URL(`${BASE_URL}/${API_VERSION}/search`);
    url.searchParams.set("type", "adgeolocation");
    url.searchParams.set("location_types", JSON.stringify([locationType]));
    url.searchParams.set("q", query);
    url.searchParams.set("access_token", accessToken);
    return url.toString();
  }

  private static buildGetUrl(
    path: string,
    accessToken: string,
    fields: string,
    cursor?: PageCursor,
  ): string {
    const url = new URL(`${BASE_URL}/${API_VERSION}/${path}`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("limit", "100");
    url.searchParams.set("access_token", accessToken);
    if (cursor?.after !== undefined) {
      url.searchParams.set("after", cursor.after);
    }
    return url.toString();
  }
}
