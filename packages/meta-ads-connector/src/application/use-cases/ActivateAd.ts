import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { MetaApiError } from "../../domain/errors/index.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";

import { callMetaApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./PullCampaignData.js";

export interface ActivateAdInput {
  readonly adId: string;
  readonly accessToken: string;
}

export interface ActivateAdOutput {
  readonly adId: string;
  readonly status: "ACTIVE";
}

/**
 * AAOS-GO-LIVE: `POST /{ad-id}` with `status: "ACTIVE"` — the inverse of the existing `pauseAd`
 * (which backs Tamara's PAUSE verdict via `VerdictExecutionService`). Go Live's rollback step
 * needs a real way to undo a PAUSE verdict it executed against a live ad during its verdict-
 * execution phase; `ActivateCampaign` alone cannot do that (campaign and ad status are
 * independent Meta fields), so this ad-level counterpart exists specifically for that rollback
 * path, per coordinator note section 6's "rollback must be real" requirement.
 */
export class ActivateAd {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: ActivateAdInput): Promise<Result<ActivateAdOutput, MetaApiError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.activate-ad",
      async (span: { end: () => void }) => {
        try {
          const result = await callMetaApi(this.rateLimiter, this.retry, () =>
            this.client.activateAd(input.adId, input.accessToken),
          );
          if (!result.ok) {
            this.logger.warn(
              { adId: input.adId, error: result.error.message },
              "meta-ads-connector: ad activation failed",
            );
            return err(result.error);
          }
          this.logger.info({ adId: input.adId }, "meta-ads-connector: ad activated");
          return ok({ adId: input.adId, status: "ACTIVE" as const });
        } finally {
          span.end();
        }
      },
    );
  }
}
