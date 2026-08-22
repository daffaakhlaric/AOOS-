import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type {
  CreateInstagramMediaContainerParams,
  IMetaOrganicClient,
  PublishFacebookPostParams,
  PublishInstagramMediaParams,
} from "../../contracts/IMetaOrganicClient.js";
import {
  ApiServerError,
  AuthError,
  MetaGraphApiError,
  PermissionError,
  RateLimitError,
} from "../../domain/errors/index.js";
import {
  FeedPostResponseSchema,
  type FeedPostResponse,
  MediaContainerResponseSchema,
  type MediaContainerResponse,
  MediaPublishResponseSchema,
  type MediaPublishResponse,
  MetaErrorResponseSchema,
  MetaInsightsResponseSchema,
  type MetaInsightsResponse,
} from "../../types/MetaGraphApiTypes.js";

import { MetaGraphApiRequestBuilder } from "./MetaGraphApiRequestBuilder.js";

const META_INVALID_TOKEN_CODE = 190;
const META_MISSING_PERMISSION_CODE = 200;
const DEFAULT_RETRY_AFTER_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 30_000;

export interface MetaGraphApiClientOptions {
  readonly timeoutMs?: number;
  /** Injectable fetch implementation — defaults to the global native `fetch`; overridable for tests. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * `fetch`-based (no axios/got) implementation of `IMetaOrganicClient`. Never throws: every failure
 * mode — HTTP error status, a non-2xx Meta error payload, a network/timeout failure, or a response
 * body that fails Zod validation — is converted to a `Result.err(MetaGraphApiError)`. Mirrors
 * `@aos/meta-ads-connector`'s `MetaApiClient` shape exactly, on purpose (same discipline, separate
 * composition root per coordinator note point 1).
 */
export class MetaGraphApiClient implements IMetaOrganicClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MetaGraphApiClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** `POST /{page-id}/feed` — see `IMetaOrganicClient.publishFacebookPost`. */
  async publishFacebookPost(
    params: PublishFacebookPostParams,
    accessToken: string,
  ): Promise<Result<FeedPostResponse, MetaGraphApiError>> {
    const responseResult = await this.doFetch(MetaGraphApiRequestBuilder.feedUrl(params.pageId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: params.message,
        ...(params.link !== undefined ? { link: params.link } : {}),
        access_token: accessToken,
      }),
    });
    if (!responseResult.ok) {
      return responseResult;
    }
    return this.parseBody(responseResult.value, FeedPostResponseSchema);
  }

  /** `POST /{ig-user-id}/media` — see `IMetaOrganicClient.createInstagramMediaContainer`. */
  async createInstagramMediaContainer(
    params: CreateInstagramMediaContainerParams,
    accessToken: string,
  ): Promise<Result<MediaContainerResponse, MetaGraphApiError>> {
    const mediaFields =
      params.media.kind === "IMAGE"
        ? { image_url: params.media.imageUrl }
        : { video_url: params.media.videoUrl, media_type: params.media.kind };
    const responseResult = await this.doFetch(
      MetaGraphApiRequestBuilder.mediaUrl(params.igUserId),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...mediaFields,
          ...(params.caption !== undefined ? { caption: params.caption } : {}),
          access_token: accessToken,
        }),
      },
    );
    if (!responseResult.ok) {
      return responseResult;
    }
    return this.parseBody(responseResult.value, MediaContainerResponseSchema);
  }

  /** `POST /{ig-user-id}/media_publish` — see `IMetaOrganicClient.publishInstagramMedia`. */
  async publishInstagramMedia(
    params: PublishInstagramMediaParams,
    accessToken: string,
  ): Promise<Result<MediaPublishResponse, MetaGraphApiError>> {
    const responseResult = await this.doFetch(
      MetaGraphApiRequestBuilder.mediaPublishUrl(params.igUserId),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          creation_id: params.creationId,
          access_token: accessToken,
        }),
      },
    );
    if (!responseResult.ok) {
      return responseResult;
    }
    return this.parseBody(responseResult.value, MediaPublishResponseSchema);
  }

  /** `GET /{post-id}/insights` — see `IMetaOrganicClient.getPagePostInsights`. */
  async getPagePostInsights(
    postId: string,
    metrics: ReadonlyArray<string>,
    accessToken: string,
  ): Promise<Result<MetaInsightsResponse, MetaGraphApiError>> {
    const url = MetaGraphApiRequestBuilder.insightsUrl(postId, metrics, accessToken);
    return this.getJson(url, MetaInsightsResponseSchema);
  }

  /** `GET /{ig-media-id}/insights` — see `IMetaOrganicClient.getInstagramMediaInsights`. */
  async getInstagramMediaInsights(
    mediaId: string,
    metrics: ReadonlyArray<string>,
    accessToken: string,
  ): Promise<Result<MetaInsightsResponse, MetaGraphApiError>> {
    const url = MetaGraphApiRequestBuilder.insightsUrl(mediaId, metrics, accessToken);
    return this.getJson(url, MetaInsightsResponseSchema);
  }

  private async getJson<T>(
    url: string,
    schema: {
      safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: unknown };
    },
  ): Promise<Result<T, MetaGraphApiError>> {
    const responseResult = await this.doFetch(url, { method: "GET" });
    if (!responseResult.ok) {
      return responseResult;
    }
    return this.parseBody(responseResult.value, schema);
  }

  private async doFetch(
    url: string,
    init: RequestInit,
  ): Promise<Result<Response, MetaGraphApiError>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        return err(await this.toMetaGraphApiError(response));
      }
      return ok(response);
    } catch (cause) {
      return err(
        new ApiServerError(`Meta Graph API network failure: ${describeCause(cause)}`, { cause }),
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
  ): Promise<Result<T, MetaGraphApiError>> {
    let json: unknown;
    try {
      json = await response.json();
    } catch (cause) {
      return err(
        new ApiServerError(
          `Meta Graph API returned a non-JSON response body: ${describeCause(cause)}`,
          { cause },
        ),
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return err(
        new ApiServerError("Meta Graph API response failed schema validation", {
          cause: new ValidationError("Meta Graph API response failed schema validation", {
            context: { zodError: parsed.error },
          }),
        }),
      );
    }
    return ok(parsed.data);
  }

  private async toMetaGraphApiError(response: Response): Promise<MetaGraphApiError> {
    const httpStatus = response.status;
    let metaErrorCode: number | undefined;
    let message = `Meta Graph API request failed with HTTP ${httpStatus}`;
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
    return new MetaGraphApiError(message, { httpStatus, metaErrorCode });
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
