import { ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { AdInterest } from "../../domain/entities/AdInterest.js";
import type { MetaApiError } from "../../domain/errors/index.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";
import { mapAdInterest } from "../../mappers/AdInterestMapper.js";

import { callMetaApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./PullCampaignData.js";

/**
 * How many interests are kept per search term. Judgment call (not pinned by any spec): Meta's
 * `/search?type=adinterest` returns its results already ordered by relevance, and everything
 * downstream of this — the `meta_interests` table, the candidate set handed to Samantha's
 * `selectTargeting` LLM call, the preview panel — is better served by a short, high-relevance list
 * than by the full long tail. Applied client-side rather than as a `limit` query param, because
 * the confirmed-live call used no such param (see `MetaApiRequestBuilder.adInterestSearchUrl`).
 */
export const MAX_INTERESTS_PER_TERM = 10;

export interface SearchAdInterestsInput {
  /** The real free-text query sent to Meta as `q=` (e.g. `"used car"`). */
  readonly term: string;
  readonly accessToken: string;
  /** Overrides `MAX_INTERESTS_PER_TERM` for this call. */
  readonly limit?: number;
}

/**
 * Reads Meta's real ad-interest catalogue: `GET /search?type=adinterest&q=<term>`
 * (AAOS-SIMULASI-TARGETING), confirmed live against the Graph API on 2026-08-18.
 *
 * SCOPE BOUNDARY — this is a READ-ONLY discovery use case. It does not, and must not, feed
 * `CreateCampaign`/`CreateAdSet`: no `targeting` field is constructed anywhere in this package's
 * real campaign-creation path, and this pass deliberately did not change that (the user's explicit
 * decision). Its only consumers are `apps/aaos-api`'s `meta_interests` sync endpoint and the
 * display-only audience preview in the Simulasi wizard.
 *
 * Same composition/reliability discipline as `CreateCampaign`: every network call goes through
 * `callMetaApi`, so the local token-bucket budget is consumed first and Meta's own 429
 * `retry-after` is fed back into the limiter. Never throws — every failure is a
 * `Result.err(MetaApiError)`.
 */
export class SearchAdInterests {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: SearchAdInterestsInput): Promise<Result<AdInterest[], MetaApiError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.search-ad-interests",
      async (span: { end: () => void }) => {
        try {
          const response = await callMetaApi(this.rateLimiter, this.retry, () =>
            this.client.searchAdInterests(input.term, input.accessToken),
          );
          if (!response.ok) {
            this.logger.warn(
              { term: input.term, error: response.error.message },
              "meta-ads-connector: ad-interest search failed",
            );
            return response;
          }

          const limit = input.limit ?? MAX_INTERESTS_PER_TERM;
          const interests = response.value.data
            .slice(0, limit)
            .map((raw) => mapAdInterest(raw, input.term));

          this.logger.info(
            { term: input.term, returned: response.value.data.length, kept: interests.length },
            "meta-ads-connector: ad-interest search completed",
          );
          return ok(interests);
        } finally {
          span.end();
        }
      },
    );
  }
}
