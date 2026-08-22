import type { Result } from "@aos/common";

import type { MetaGraphApiError } from "../domain/errors/index.js";
import type {
  FeedPostResponse,
  MediaContainerResponse,
  MediaPublishResponse,
  MetaInsightsResponse,
} from "../types/MetaGraphApiTypes.js";

/**
 * Input for `IMetaOrganicClient.publishFacebookPost` — mirrors Meta's real
 * `POST /{page-id}/feed` body shape (verified 2026-08-22 against Meta's Pages API "Posts" guide).
 */
export interface PublishFacebookPostParams {
  readonly pageId: string;
  readonly message: string;
  /** Optional URL Meta renders as a link-preview card underneath the post. */
  readonly link?: string;
}

/** Discriminated union for `CreateInstagramMediaContainerParams.media` — statically forces exactly one of image/video, rather than a validation check at runtime (mirrors `@aos/meta-ads-connector`'s `CreateAdCreativeSpec` pattern). */
export interface InstagramImageMediaSpec {
  readonly kind: "IMAGE";
  readonly imageUrl: string;
}

export interface InstagramVideoMediaSpec {
  readonly kind: "VIDEO" | "REELS" | "STORIES";
  readonly videoUrl: string;
}

export type InstagramMediaSpec = InstagramImageMediaSpec | InstagramVideoMediaSpec;

/**
 * Input for `IMetaOrganicClient.createInstagramMediaContainer` — mirrors Meta's real
 * `POST /{ig-user-id}/media` body shape (verified 2026-08-22 against Meta's Instagram Platform
 * "Content Publishing" guide).
 */
export interface CreateInstagramMediaContainerParams {
  readonly igUserId: string;
  readonly media: InstagramMediaSpec;
  readonly caption?: string;
}

/** Input for `IMetaOrganicClient.publishInstagramMedia` — mirrors Meta's real `POST /{ig-user-id}/media_publish` body shape. */
export interface PublishInstagramMediaParams {
  readonly igUserId: string;
  /** The container id returned by a prior `createInstagramMediaContainer` call. */
  readonly creationId: string;
}

/**
 * Port (Hexagonal Architecture) for talking to Meta's Graph API surface used for organic
 * Pages/Instagram content publishing. The only implementation shipped in this package is
 * `infrastructure/meta-api/MetaGraphApiClient.ts` (fetch-based); tests substitute MSW-mocked HTTP
 * instead of a fake of this interface, exercising the real adapter — same discipline as
 * `@aos/meta-ads-connector`'s `IMetaAdsClient`. Every method returns a
 * `Promise<Result<T, MetaGraphApiError>>` — never throws.
 */
export interface IMetaOrganicClient {
  /** `POST /{page-id}/feed` — publishes a text (+ optional link) post to a Facebook Page. */
  publishFacebookPost(
    params: PublishFacebookPostParams,
    accessToken: string,
  ): Promise<Result<FeedPostResponse, MetaGraphApiError>>;

  /** `POST /{ig-user-id}/media` — creates an Instagram media container (image or video + caption), returning a container id usable in `publishInstagramMedia`. */
  createInstagramMediaContainer(
    params: CreateInstagramMediaContainerParams,
    accessToken: string,
  ): Promise<Result<MediaContainerResponse, MetaGraphApiError>>;

  /** `POST /{ig-user-id}/media_publish` — publishes a previously-created media container. */
  publishInstagramMedia(
    params: PublishInstagramMediaParams,
    accessToken: string,
  ): Promise<Result<MediaPublishResponse, MetaGraphApiError>>;

  /**
   * `GET /{post-id}/insights` — real post-level insights for a published Facebook Page post.
   * `metrics` must be Page-post-specific metric names (e.g. `post_impressions`,
   * `post_impressions_unique`, `post_clicks`, `post_reactions_by_type_total`) — see
   * `MetaGraphApiRequestBuilder.PAGE_POST_INSIGHTS_METRICS`'s docstring for which ones this
   * package requests and why.
   */
  getPagePostInsights(
    postId: string,
    metrics: ReadonlyArray<string>,
    accessToken: string,
  ): Promise<Result<MetaInsightsResponse, MetaGraphApiError>>;

  /**
   * `GET /{ig-media-id}/insights` — real media-level insights for a published Instagram post.
   * `metrics` must be IG-media-specific metric names (e.g. `reach`, `likes`, `comments`, `saved`,
   * `shares`, `total_interactions` — NOT `impressions`/`video_views`, both deprecated by Meta in
   * Graph API v22 in favor of `views`) — see
   * `MetaGraphApiRequestBuilder.IG_MEDIA_INSIGHTS_METRICS`'s docstring.
   */
  getInstagramMediaInsights(
    mediaId: string,
    metrics: ReadonlyArray<string>,
    accessToken: string,
  ): Promise<Result<MetaInsightsResponse, MetaGraphApiError>>;
}
