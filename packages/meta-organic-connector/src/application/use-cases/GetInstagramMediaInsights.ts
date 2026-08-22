import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { IMetaOrganicClient } from "../../contracts/IMetaOrganicClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { MetaGraphApiError } from "../../domain/errors/index.js";
import { IG_MEDIA_INSIGHTS_METRICS } from "../../infrastructure/meta-api/MetaGraphApiRequestBuilder.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";
import type { MetaInsightsResponse } from "../../types/MetaGraphApiTypes.js";

import { callMetaOrganicApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./Tracer.js";

export interface GetInstagramMediaInsightsInput {
  readonly mediaId: string;
  readonly accessToken: string;
  /** Override the default metric list — defaults to `IG_MEDIA_INSIGHTS_METRICS` (real, currently-valid IG-media metric names; excludes `impressions`/`video_views`, both deprecated by Meta in Graph API v22). */
  readonly metrics?: ReadonlyArray<string>;
}

/**
 * AAOS-SOSMED-AUTOMATION Phase 2: `GET /{ig-media-id}/insights` — real media-level insights for a
 * published Instagram post. Returns the raw, validated Meta response rather than a mapped shape —
 * see `GetPagePostInsights`'s docstring for why. Endpoint verified 2026-08-22 against Meta's
 * Instagram Platform Insights guide/reference.
 */
export class GetInstagramMediaInsights {
  constructor(
    private readonly client: IMetaOrganicClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: GetInstagramMediaInsightsInput,
  ): Promise<Result<MetaInsightsResponse, MetaGraphApiError>> {
    return this.tracer.startActiveSpan(
      "meta-organic-connector.get-instagram-media-insights",
      async (span: { end: () => void }) => {
        try {
          const result = await callMetaOrganicApi(this.rateLimiter, this.retry, () =>
            this.client.getInstagramMediaInsights(
              input.mediaId,
              input.metrics ?? IG_MEDIA_INSIGHTS_METRICS,
              input.accessToken,
            ),
          );
          if (!result.ok) {
            this.logger.warn(
              { mediaId: input.mediaId, error: result.error.message },
              "meta-organic-connector: Instagram media insights fetch failed",
            );
            return err(result.error);
          }
          return ok(result.value);
        } finally {
          span.end();
        }
      },
    );
  }
}
