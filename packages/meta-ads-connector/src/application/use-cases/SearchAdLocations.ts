import { ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { AdLocation } from "../../domain/entities/AdLocation.js";
import type { MetaApiError } from "../../domain/errors/index.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";
import { mapAdLocation } from "../../mappers/AdLocationMapper.js";

import { callMetaApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./PullCampaignData.js";

export interface SearchAdLocationsInput {
  /** The real free-text city name sent to Meta as `q=` (e.g. a `ResolvedLocation.cities[]` entry like `"Bandung"`). */
  readonly query: string;
  /** Always `"city"` today — the only `location_types` value this use case exercises (AAOS EPIC S, Phase S2 scope). */
  readonly locationType: "city";
  readonly accessToken: string;
}

/**
 * Reads Meta's real location-search catalogue:
 * `GET /search?type=adgeolocation&location_types=["city"]&q=<query>` (AAOS EPIC S, Phase S2).
 * Verified 2026-09-01 against Meta's Marketing API "Targeting Search" reference
 * (developers.facebook.com/docs/marketing-api/audiences/reference/targeting-search) — no live call
 * available in this environment (unlike `SearchAdInterests`'s 2026-08-18 live capture), so this use
 * case and its Zod schema are built directly against the documented endpoint/response shape rather
 * than a captured payload; see `MetaAdLocationSchema`'s own docstring for the exact citation and
 * `tests/helpers/ad-location-fixtures.ts` for this fixture provenance note.
 *
 * Real, documented no-match/ambiguous-match behavior (per the same reference):
 * - **Zero matches**: Meta returns `{"data": []}` — never an error. This use case surfaces that
 *   as an honest `ok([])`, never a fabricated `key` — not every free-text city name a
 *   `LocationResolverService`/LLM might produce will have an exact Meta match (a real, expected
 *   outcome per this file's own scope note in `docs/PROMPT-AAOS-PROPERTY-CAMPAIGN-AND-CREATIVE.md`,
 *   Finding 3/S2). Callers (a later phase, not this one) are responsible for deciding what "skip
 *   this city" means for their own targeting payload.
 * - **Ambiguous matches** (e.g. multiple distinct real cities/regions sharing one name): Meta
 *   returns every matching row in `data[]`, undifferentiated except by `region`/`region_id`/`key`.
 *   This use case does NOT attempt to auto-disambiguate or pick a "best" match — it maps and
 *   returns every real row Meta reported, in Meta's own relevance order, honestly. Auto-selection
 *   logic (if ever wanted) belongs to a later phase's caller, not this read-only search use case.
 *
 * SCOPE BOUNDARY — same as `SearchAdInterests`: this is a READ-ONLY discovery use case. It does
 * not, and must not, feed `CreateCampaign`/`CreateAdSet` itself; it does not call
 * `LocationResolverService` either (AAOS EPIC S, Phase S2 is the standalone geo-search capability
 * only — wiring `ResolvedLocation.cities` through it is S3/S4, a later phase).
 *
 * Same composition/reliability discipline as `SearchAdInterests`: every network call goes through
 * `callMetaApi`, so the local token-bucket budget is consumed first and Meta's own 429
 * `retry-after` is fed back into the limiter. Never throws — every failure is a
 * `Result.err(MetaApiError)`.
 */
export class SearchAdLocations {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(input: SearchAdLocationsInput): Promise<Result<AdLocation[], MetaApiError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.search-ad-locations",
      async (span: { end: () => void }) => {
        try {
          const response = await callMetaApi(this.rateLimiter, this.retry, () =>
            this.client.searchAdLocations(input.query, input.locationType, input.accessToken),
          );
          if (!response.ok) {
            this.logger.warn(
              { query: input.query, error: response.error.message },
              "meta-ads-connector: ad-location search failed",
            );
            return response;
          }

          const locations = response.value.data.map((raw) => mapAdLocation(raw, input.query));

          this.logger.info(
            { query: input.query, returned: locations.length },
            "meta-ads-connector: ad-location search completed",
          );
          return ok(locations);
        } finally {
          span.end();
        }
      },
    );
  }
}
