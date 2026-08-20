import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { MetaApiError } from "../../domain/errors/index.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";

import { callMetaApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./PullCampaignData.js";

export interface ActivateCampaignInput {
  readonly campaignId: string;
  readonly accessToken: string;
}

export interface ActivateCampaignOutput {
  readonly campaignId: string;
  readonly status: "ACTIVE";
}

/**
 * AAOS-GO-LIVE: `POST /{campaign-id}` with `status: "ACTIVE"` — activates a real campaign. Used
 * by Go Live to flip the newly-created campaign live once its ad set and ad are in place, and by
 * rollback... no — rollback uses `PauseCampaign` on the newly-created campaign and this use case
 * to re-activate whatever the Go Live verdict-execution step paused (see `ActivateAd` for the
 * ad-level counterpart, and `docs/PROMPT-AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY.md` coordinator
 * note section 6 for the rollback requirement this exists to satisfy).
 */
export class ActivateCampaign {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: ActivateCampaignInput,
  ): Promise<Result<ActivateCampaignOutput, MetaApiError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.activate-campaign",
      async (span: { end: () => void }) => {
        try {
          const result = await callMetaApi(this.rateLimiter, this.retry, () =>
            this.client.activateCampaign(input.campaignId, input.accessToken),
          );
          if (!result.ok) {
            this.logger.warn(
              { campaignId: input.campaignId, error: result.error.message },
              "meta-ads-connector: campaign activation failed",
            );
            return err(result.error);
          }
          this.logger.info(
            { campaignId: input.campaignId },
            "meta-ads-connector: campaign activated",
          );
          return ok({ campaignId: input.campaignId, status: "ACTIVE" as const });
        } finally {
          span.end();
        }
      },
    );
  }
}
