import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { CreateAdCreativeSpec, IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { MetaApiError } from "../../domain/errors/index.js";
import type { AdAccountId } from "../../domain/value-objects/AdAccountId.js";
import { AdStatus } from "../../domain/value-objects/AdStatus.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";

import { callMetaApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./PullCampaignData.js";

export interface CreateAdInput {
  readonly adAccountId: AdAccountId;
  readonly adSetId: string;
  readonly name: string;
  /** The tenant's Facebook Page id — real ads require `object_story_spec.page_id`. */
  readonly pageId: string;
  readonly creative: CreateAdCreativeSpec;
  readonly accessToken: string;
  /** Defaults to `AdStatus.ACTIVE` — Go Live only ever creates an ad after DSS has already approved the simulation, so (unlike `CreateCampaign`'s always-`PAUSED` ads) there is no further human gate to wait for. Callers may still override to `PAUSED` for a dry-run-adjacent real create. */
  readonly status?: string;
}

export interface CreateAdOutput {
  readonly adId: string;
}

/**
 * AAOS-GO-LIVE: `POST /{ad-account}/ads` — creates a single real ad under an existing ad set,
 * with a video or image creative attached (`object_story_spec.video_data`/`link_data`). This is
 * the capability coordinator note section 8 confirmed does not exist anywhere in this connector
 * (`IMetaAdsClient` had no single-ad create) — built here following `CreateCampaign`'s
 * contract-first, `Result<T,E>`, rate-limited/retried/traced shape.
 */
export class CreateAd {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: CreateAdInput): Promise<Result<CreateAdOutput, MetaApiError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.create-ad",
      async (span: { end: () => void }) => {
        try {
          const result = await callMetaApi(this.rateLimiter, this.retry, () =>
            this.client.createAd(
              input.adAccountId.toString(),
              {
                adSetId: input.adSetId,
                name: input.name,
                pageId: input.pageId,
                creative: input.creative,
                status: input.status ?? AdStatus.ACTIVE,
              },
              input.accessToken,
            ),
          );
          if (!result.ok) {
            this.logger.warn(
              { adSetId: input.adSetId, error: result.error.message },
              "meta-ads-connector: ad creation failed",
            );
            return err(result.error);
          }
          this.logger.info(
            { adId: result.value.id, adSetId: input.adSetId },
            "meta-ads-connector: ad created",
          );
          return ok({ adId: result.value.id });
        } finally {
          span.end();
        }
      },
    );
  }
}
