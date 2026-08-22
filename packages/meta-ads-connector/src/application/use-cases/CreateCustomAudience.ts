import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { MetaApiError } from "../../domain/errors/index.js";
import type { AdAccountId } from "../../domain/value-objects/AdAccountId.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";

import { callMetaApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./PullCampaignData.js";

export interface CreateCustomAudienceInput {
  readonly adAccountId: AdAccountId;
  readonly name: string;
  readonly description?: string;
  readonly customerFileSource?:
    "USER_PROVIDED_ONLY" | "PARTNER_PROVIDED_ONLY" | "BOTH_USER_AND_PARTNER_PROVIDED";
  readonly accessToken: string;
}

export interface CreateCustomAudienceOutput {
  readonly audienceId: string;
}

/**
 * AAOS-ABTESTING-LOOKALIKE Part 2: `POST /act_{ad-account-id}/customaudiences` — creates a new,
 * empty `subtype: "CUSTOM"` audience (e.g. a tenant's hot-leads audience). Coordinator note point
 * 3 confirmed this capability did not exist anywhere in `IMetaAdsClient` before this change; built
 * following `CreateAd.ts`'s contract-first, `Result<T,E>`, rate-limited/retried/traced shape.
 * Endpoint/params verified 2026-08-21 against Meta's Marketing API "Custom Audiences" guide.
 */
export class CreateCustomAudience {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: CreateCustomAudienceInput,
  ): Promise<Result<CreateCustomAudienceOutput, MetaApiError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.create-custom-audience",
      async (span: { end: () => void }) => {
        try {
          const result = await callMetaApi(this.rateLimiter, this.retry, () =>
            this.client.createCustomAudience(
              input.adAccountId.toString(),
              {
                name: input.name,
                subtype: "CUSTOM",
                description: input.description,
                customerFileSource: input.customerFileSource ?? "USER_PROVIDED_ONLY",
              },
              input.accessToken,
            ),
          );
          if (!result.ok) {
            this.logger.warn(
              { name: input.name, error: result.error.message },
              "meta-ads-connector: custom audience creation failed",
            );
            return err(result.error);
          }
          this.logger.info(
            { audienceId: result.value.id, name: input.name },
            "meta-ads-connector: custom audience created",
          );
          return ok({ audienceId: result.value.id });
        } finally {
          span.end();
        }
      },
    );
  }
}
