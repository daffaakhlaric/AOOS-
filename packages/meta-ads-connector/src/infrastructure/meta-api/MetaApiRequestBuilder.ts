import type { PageCursor } from "../../contracts/IMetaAdsClient.js";

const API_VERSION = "v21.0";
const BASE_URL = "https://graph.facebook.com";

/** `created_time` is requested beyond the spec's literal field list — see `mappers/CampaignMapper.ts`'s docstring for why. */
const CAMPAIGN_FIELDS = ["id", "name", "objective", "status", "created_time"].join(",");

const ADSET_FIELDS = ["id", "name", "status", "daily_budget"].join(",");

const AD_FIELDS = ["id", "name", "status", "created_time"].join(",");

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
