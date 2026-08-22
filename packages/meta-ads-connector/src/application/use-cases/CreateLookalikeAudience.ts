import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { MetaApiError } from "../../domain/errors/index.js";
import type { AdAccountId } from "../../domain/value-objects/AdAccountId.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";

import { callMetaApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./PullCampaignData.js";

export interface CreateLookalikeAudienceInput {
  readonly adAccountId: AdAccountId;
  readonly name: string;
  readonly originAudienceId: string;
  /** 1, 2, or 3 (percent) — converted to Meta's real `ratio` (0.01/0.02/0.03) internally. */
  readonly percentage: 1 | 2 | 3;
  /** ISO 3166-1 alpha-2 country code, e.g. `"ID"`. */
  readonly country: string;
  readonly accessToken: string;
}

export interface CreateLookalikeAudienceOutput {
  readonly audienceId: string;
}

/**
 * AAOS-ABTESTING-LOOKALIKE Part 2: `POST /act_{ad-account-id}/customaudiences` with
 * `subtype: "LOOKALIKE"` — generates a Lookalike Audience seeded from an existing Custom
 * Audience. Coordinator note point 3 confirmed this capability did not exist anywhere in
 * `IMetaAdsClient` before this change; built following `CreateAd.ts`'s contract-first,
 * `Result<T,E>`, rate-limited/retried/traced shape. Endpoint/params verified 2026-08-21 against
 * Meta's Marketing API "Lookalike Audiences" guide — Lookalikes are a Custom-Audience-shaped
 * resource on the SAME endpoint as `CreateCustomAudience`, not a separate Graph API call, contrary
 * to the spec's imagined `createLookalikeAudience` method name suggesting otherwise.
 */
export class CreateLookalikeAudience {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: CreateLookalikeAudienceInput,
  ): Promise<Result<CreateLookalikeAudienceOutput, MetaApiError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.create-lookalike-audience",
      async (span: { end: () => void }) => {
        try {
          const result = await callMetaApi(this.rateLimiter, this.retry, () =>
            this.client.createLookalikeAudience(
              input.adAccountId.toString(),
              {
                name: input.name,
                originAudienceId: input.originAudienceId,
                ratio: input.percentage / 100,
                country: input.country,
              },
              input.accessToken,
            ),
          );
          if (!result.ok) {
            this.logger.warn(
              { name: input.name, error: result.error.message },
              "meta-ads-connector: lookalike audience creation failed",
            );
            return err(result.error);
          }
          this.logger.info(
            { audienceId: result.value.id, name: input.name, percentage: input.percentage },
            "meta-ads-connector: lookalike audience created",
          );
          return ok({ audienceId: result.value.id });
        } finally {
          span.end();
        }
      },
    );
  }
}
