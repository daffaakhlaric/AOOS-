import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { IMetaOrganicClient } from "../../contracts/IMetaOrganicClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { MetaGraphApiError } from "../../domain/errors/index.js";
import { PAGE_POST_INSIGHTS_METRICS } from "../../infrastructure/meta-api/MetaGraphApiRequestBuilder.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";
import type { MetaInsightsResponse } from "../../types/MetaGraphApiTypes.js";

import { callMetaOrganicApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./Tracer.js";

export interface GetPagePostInsightsInput {
  readonly postId: string;
  readonly accessToken: string;
  /** Override the default metric list — defaults to `PAGE_POST_INSIGHTS_METRICS` (real, currently-valid Page-post metric names). */
  readonly metrics?: ReadonlyArray<string>;
}

/**
 * AAOS-SOSMED-AUTOMATION Phase 2: `GET /{post-id}/insights` — real post-level insights for a
 * published Facebook Page post. Returns the raw, validated Meta response (`MetaInsightsResponse`)
 * rather than a mapped shape — mapping into `StoredScheduledPost`'s
 * `reach`/`impressions`/`likes`/`comments`/`shares`/`engagementCount` columns is a later phase's
 * concern (the insights-sync scheduler, per the coordinator note's phase-3 scope), not this
 * package's. Endpoint verified 2026-08-22 against Meta's Graph API Insights reference.
 */
export class GetPagePostInsights {
  constructor(
    private readonly client: IMetaOrganicClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: GetPagePostInsightsInput,
  ): Promise<Result<MetaInsightsResponse, MetaGraphApiError>> {
    return this.tracer.startActiveSpan(
      "meta-organic-connector.get-page-post-insights",
      async (span: { end: () => void }) => {
        try {
          const result = await callMetaOrganicApi(this.rateLimiter, this.retry, () =>
            this.client.getPagePostInsights(
              input.postId,
              input.metrics ?? PAGE_POST_INSIGHTS_METRICS,
              input.accessToken,
            ),
          );
          if (!result.ok) {
            this.logger.warn(
              { postId: input.postId, error: result.error.message },
              "meta-organic-connector: Page post insights fetch failed",
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
