const API_VERSION = "v21.0";
const BASE_URL = "https://graph.facebook.com";

/**
 * Facebook Page post insights metric names — verified 2026-08-22 against Meta's real Graph API
 * Insights reference. Deliberately a small, currently-valid subset (Meta has deprecated many
 * `post_*` metrics over time — e.g. `post_engaged_users` is no longer documented as valid): reach
 * (`post_impressions_unique`), impressions (`post_impressions`), engagement (`post_clicks`), and
 * reactions (`post_reactions_by_type_total`) — matching the spec's requested reach/impressions/
 * engagement/reactions intent as closely as real, currently-valid metric names allow.
 */
export const PAGE_POST_INSIGHTS_METRICS: ReadonlyArray<string> = [
  "post_impressions",
  "post_impressions_unique",
  "post_clicks",
  "post_reactions_by_type_total",
];

/**
 * Instagram media insights metric names — verified 2026-08-22 against Meta's real Instagram
 * Platform Insights guide/reference. `impressions` and `video_views` were deprecated by Meta in
 * Graph API v22 (replaced by `views`) — deliberately NOT requested here. `reach` remains valid and
 * is the closest real equivalent to the spec's "reach" ask; `likes`/`comments`/`saved`/`shares`/
 * `total_interactions` cover "engagement".
 */
export const IG_MEDIA_INSIGHTS_METRICS: ReadonlyArray<string> = [
  "reach",
  "likes",
  "comments",
  "saved",
  "shares",
  "total_interactions",
];

/** Pure, side-effect-free URL builders for Meta's Graph API Pages/Instagram publishing surface — no `fetch` here, so they're trivially unit-testable and reusable by `MetaGraphApiClient`. */
export class MetaGraphApiRequestBuilder {
  /** `POST /{page-id}/feed` — see `IMetaOrganicClient.publishFacebookPost`. */
  static feedUrl(pageId: string): string {
    return `${BASE_URL}/${API_VERSION}/${pageId}/feed`;
  }

  /** `POST /{ig-user-id}/media` — see `IMetaOrganicClient.createInstagramMediaContainer`. */
  static mediaUrl(igUserId: string): string {
    return `${BASE_URL}/${API_VERSION}/${igUserId}/media`;
  }

  /** `POST /{ig-user-id}/media_publish` — see `IMetaOrganicClient.publishInstagramMedia`. */
  static mediaPublishUrl(igUserId: string): string {
    return `${BASE_URL}/${API_VERSION}/${igUserId}/media_publish`;
  }

  /** `GET /{post-id}/insights` and `GET /{ig-media-id}/insights` share the same URL shape — only the `metric` list requested differs (see this module's metric-name constants). */
  static insightsUrl(nodeId: string, metrics: ReadonlyArray<string>, accessToken: string): string {
    const url = new URL(`${BASE_URL}/${API_VERSION}/${nodeId}/insights`);
    url.searchParams.set("metric", metrics.join(","));
    url.searchParams.set("access_token", accessToken);
    return url.toString();
  }
}
