import type { Logger } from "@aos/logger";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { AdAccountId } from "../../domain/value-objects/AdAccountId.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";

import { callMetaApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./PullCampaignData.js";

/**
 * Hard cap on how many per-video-id Graph calls ONE `execute()` will make. Images are batched into
 * a single call regardless of count (Meta's `adimages?hashes=[...]` edge — see
 * `MetaApiRequestBuilder.adImagesByHashesUrl`), but Meta exposes no equivalent batch-by-id read for
 * videos, so each distinct video id genuinely costs one call. The connector's real budget is
 * 200 calls/hour (`TokenBucketRateLimiter`), and the Command Center incident documented on
 * `CommandCenterService`'s `ACCOUNT_SUMMARY_CACHE_TTL_MS` was caused by exactly this kind of
 * unbounded per-object fanout. 20 comfortably covers a Command Center page (which renders a
 * handful of campaign rows, one representative creative each) while making the worst case
 * bounded and stateable: 1 + 20 = at most 21 calls per uncached resolution.
 *
 * Video ids beyond the cap are reported honestly in `output.unresolvedVideoIds` — never silently
 * dropped, and never substituted with another video's thumbnail.
 */
export const MAX_VIDEO_THUMBNAIL_CALLS = 20;

export interface ResolveCreativeThumbnailsInput {
  readonly adAccountId: AdAccountId;
  /** Real Meta image hashes (`meta_ads.creative_ref` for an `IMAGE` creative). Deduplicated by this use case before the single batched call. */
  readonly imageHashes: ReadonlyArray<string>;
  /** Real Meta video ids (`meta_ads.creative_ref` for a `VIDEO` creative). Deduplicated, then capped at `MAX_VIDEO_THUMBNAIL_CALLS`. */
  readonly videoIds: ReadonlyArray<string>;
  readonly accessToken: string;
}

export interface ResolveCreativeThumbnailsOutput {
  /**
   * Real, renderable thumbnail URL per resolved creative ref (image hash OR video id — the two id
   * spaces do not collide, so one flat map is honest). A ref that Meta did not resolve is simply
   * ABSENT, never mapped to a placeholder/stock URL.
   */
  readonly thumbnailUrlsByRef: ReadonlyMap<string, string>;
  /** Refs that were requested but genuinely produced no URL (Meta omitted the row, returned no `url`/`picture`/`thumbnails`, the call failed, or — for videos — the `MAX_VIDEO_THUMBNAIL_CALLS` cap was hit). */
  readonly unresolvedImageHashes: ReadonlyArray<string>;
  readonly unresolvedVideoIds: ReadonlyArray<string>;
  /** Real, honest per-call failure reasons (rate-limit exhaustion, Meta error, schema mismatch). Empty when every attempted call succeeded. */
  readonly errors: ReadonlyArray<string>;
}

/**
 * AAOS Command Center creative thumbnails — resolves real Meta creative REFS (an image `hash` or a
 * `video_id`, which is all `Ad.creativeAsset`/`meta_ads.creative_ref` actually carries) to real,
 * renderable thumbnail URLs. This is the missing hop between "we know which Meta creative backs
 * this ad" and "we can show its picture": neither the campaign-tree pull nor `UploadCreativeAsset`
 * ever produced a URL for an already-existing creative.
 *
 * DELIBERATELY NEVER RETURNS `Result.err` — unlike every sibling use case in this package. A
 * thumbnail is purely decorative: the Command Center row it decorates must render (with its honest
 * placeholder) whether or not Meta cooperated. Folding a hard failure into the caller's control
 * flow would make a cosmetic lookup able to blank a real decision queue — precisely the regression
 * class this feature was asked to avoid. Every failure is instead reported in the output
 * (`errors` + `unresolved*`), so the caller can log it honestly while still rendering.
 *
 * Call cost, worst case, for one `execute()`: 1 batched images call + up to
 * `MAX_VIDEO_THUMBNAIL_CALLS` per-video calls. Zero calls when the corresponding input list is
 * empty. Every call goes through `callMetaApi`, so the real 200/hour `TokenBucketRateLimiter`
 * budget and `ExponentialBackoffRetry` apply exactly as they do to every other Meta call here.
 * Hash/video-id → URL is effectively immutable for a given asset, so the caller is expected to
 * cache the result with a LONG TTL rather than re-resolving per page load.
 */
export class ResolveCreativeThumbnails {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: ResolveCreativeThumbnailsInput): Promise<ResolveCreativeThumbnailsOutput> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.resolve-creative-thumbnails",
      async (span: { end: () => void }) => {
        try {
          const thumbnailUrlsByRef = new Map<string, string>();
          const errors: string[] = [];

          const hashes = dedupe(input.imageHashes);
          const videoIds = dedupe(input.videoIds);

          const unresolvedImageHashes = await this.resolveImages(
            input,
            hashes,
            thumbnailUrlsByRef,
            errors,
          );
          const unresolvedVideoIds = await this.resolveVideos(
            input,
            videoIds,
            thumbnailUrlsByRef,
            errors,
          );

          return {
            thumbnailUrlsByRef,
            unresolvedImageHashes,
            unresolvedVideoIds,
            errors,
          };
        } finally {
          span.end();
        }
      },
    );
  }

  /** ONE batched `GET /act_X/adimages?hashes=[...]` for every requested hash — never one call per hash. */
  private async resolveImages(
    input: ResolveCreativeThumbnailsInput,
    hashes: ReadonlyArray<string>,
    into: Map<string, string>,
    errors: string[],
  ): Promise<ReadonlyArray<string>> {
    if (hashes.length === 0) {
      return [];
    }
    const result = await callMetaApi(this.rateLimiter, this.retry, () =>
      this.client.getAdImagesByHashes(input.adAccountId.toString(), hashes, input.accessToken),
    );
    if (!result.ok) {
      errors.push(`adimages(${String(hashes.length)} hashes): ${result.error.message}`);
      this.logger.warn(
        { adAccountId: input.adAccountId.toString(), error: result.error.message },
        "meta-ads-connector: batched adimages thumbnail resolution failed — rows degrade to their placeholder",
      );
      return hashes;
    }
    for (const image of result.value.data) {
      // Meta's own CDN `url` first (the direct, renderable asset), falling back to the stable
      // `permalink_url`. Neither is ever synthesized — a row carrying neither yields no thumbnail.
      const url = image.url ?? image.permalink_url;
      if (url !== undefined && url.length > 0) {
        into.set(image.hash, url);
      }
    }
    return hashes.filter((hash) => !into.has(hash));
  }

  /** One `GET /{video-id}` per distinct video id (no batch-by-id edge exists), capped at `MAX_VIDEO_THUMBNAIL_CALLS`. */
  private async resolveVideos(
    input: ResolveCreativeThumbnailsInput,
    videoIds: ReadonlyArray<string>,
    into: Map<string, string>,
    errors: string[],
  ): Promise<ReadonlyArray<string>> {
    const attempted = videoIds.slice(0, MAX_VIDEO_THUMBNAIL_CALLS);
    const skipped = videoIds.slice(MAX_VIDEO_THUMBNAIL_CALLS);
    if (skipped.length > 0) {
      errors.push(
        `video thumbnails: ${String(skipped.length)} video id(s) skipped — MAX_VIDEO_THUMBNAIL_CALLS (${String(MAX_VIDEO_THUMBNAIL_CALLS)}) reached`,
      );
    }

    for (const videoId of attempted) {
      const result = await callMetaApi(this.rateLimiter, this.retry, () =>
        this.client.getVideoThumbnail(videoId, input.accessToken),
      );
      if (!result.ok) {
        errors.push(`video ${videoId}: ${result.error.message}`);
        this.logger.warn(
          { videoId, error: result.error.message },
          "meta-ads-connector: video thumbnail resolution failed — that row degrades to its placeholder",
        );
        continue;
      }
      const url = pickVideoThumbnailUrl(result.value);
      if (url !== undefined) {
        into.set(videoId, url);
      }
    }

    return [...attempted.filter((videoId) => !into.has(videoId)), ...skipped];
  }
}

/**
 * Meta's own Ads-Manager-selected poster frame first (`thumbnails.data[].is_preferred === true`),
 * then the video's auto-selected `picture`, then simply the first generated frame. All three are
 * real Meta-returned URLs — the order is "closest to what a human already chose in Ads Manager",
 * never a fabricated fallback.
 */
function pickVideoThumbnailUrl(response: {
  readonly picture?: string;
  readonly thumbnails?: {
    readonly data: ReadonlyArray<{ readonly uri: string; readonly is_preferred?: boolean }>;
  };
}): string | undefined {
  const frames = response.thumbnails?.data ?? [];
  const preferred = frames.find((frame) => frame.is_preferred === true)?.uri;
  const candidate = preferred ?? response.picture ?? frames[0]?.uri;
  return candidate !== undefined && candidate.length > 0 ? candidate : undefined;
}

/** Deduplicates while preserving the caller's order, and drops empty refs (a real `creative_ref` is never empty, so an empty one is never worth a Meta call). */
function dedupe(refs: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(refs.filter((ref) => ref.length > 0))];
}
