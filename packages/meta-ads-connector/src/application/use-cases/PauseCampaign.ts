import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { MetaApiError } from "../../domain/errors/index.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";

import { callMetaApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./PullCampaignData.js";

export interface PauseCampaignInput {
  readonly campaignId: string;
  readonly accessToken: string;
}

export interface PauseCampaignOutput {
  readonly campaignId: string;
  readonly status: "PAUSED";
}

/**
 * AAOS-GO-LIVE: `POST /{campaign-id}` with `status: "PAUSED"` — pauses a real campaign. The
 * package's `IMetaAdsClient` previously only exposed ad-level pausing (`pauseAd`, driven by
 * Samantha's PAUSE verdict); this campaign-level pause is new, built specifically so Go Live's
 * rollback can pause the campaign it just created (see coordinator note section 8).
 */
export class PauseCampaign {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: PauseCampaignInput): Promise<Result<PauseCampaignOutput, MetaApiError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.pause-campaign",
      async (span: { end: () => void }) => {
        try {
          const result = await callMetaApi(this.rateLimiter, this.retry, () =>
            this.client.pauseCampaign(input.campaignId, input.accessToken),
          );
          if (!result.ok) {
            this.logger.warn(
              { campaignId: input.campaignId, error: result.error.message },
              "meta-ads-connector: campaign pause failed",
            );
            return err(result.error);
          }
          this.logger.info({ campaignId: input.campaignId }, "meta-ads-connector: campaign paused");
          return ok({ campaignId: input.campaignId, status: "PAUSED" as const });
        } finally {
          span.end();
        }
      },
    );
  }
}
