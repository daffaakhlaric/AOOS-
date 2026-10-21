import { ValidationError } from "@aos/errors";
import type { AdLocation, CreateAdSetTargeting, SearchAdLocations } from "@aos/meta-ads-connector";

import type { ResolvedLocation } from "../../location-resolver/location-resolver.service.js";
import type { MatchedPropertyCity } from "../dto/create-property-campaign.dto.js";

/** Meta's real accepted `targeting.geo_locations.cities[].radius` range for `distanceUnit: "kilometer"` — see `MetaTargetingCity`'s own doc (`IMetaAdsClient.ts`). */
// Meta currently rejects the lower boundary for HOUSING in some ad accounts;
// 25 km is the first stable value accepted across the API versions we use.
const MIN_RADIUS_KM = 25;
const MAX_RADIUS_KM = 80;

export interface PropertyTargetingResult {
  readonly targeting: CreateAdSetTargeting;
  readonly matchedCities: readonly MatchedPropertyCity[];
  readonly unresolvedCities: readonly string[];
}

/**
 * AAOS EPIC S, Phase S3/S4 — real Meta geo-search translation for a PROPERTY campaign's HOUSING
 * targeting. Only ever called from `CampaignsService.createPropertyCampaign`'s LIVE-mode
 * `executeFn` (never DEV's `simulateFn`) — this function itself performs real Meta calls
 * (`SearchAdLocations.execute`), so keeping it out of the DEV path is what makes "DEV never calls
 * real Meta" true for the ENTIRE PROPERTY campaign-creation pipeline, not just the final
 * `createCampaign`/`createAdSet` calls.
 *
 * For each of `resolvedLocation.cities` (free-text names from `LocationResolverService`):
 * - **Zero real matches** (`SearchAdLocations` returns `ok([])`, or itself fails/`err`s — both are
 *   treated the same way here: a real inability to resolve this one city, never a hard abort of
 *   the whole campaign): the city is skipped and recorded in `unresolvedCities`, never fabricated.
 * - **Ambiguous matches** (`SearchAdLocations` returns 2+ real rows — same-named cities in
 *   different regions, etc.): this function's own, explicit, documented tie-break rule is to take
 *   `[0]` — the FIRST result, i.e. Meta's own most-relevant match, per `SearchAdLocations`'s own
 *   docstring ("maps and returns every real row Meta reported, in Meta's own relevance order").
 *   Every other real row is discarded, never silently included.
 *
 * **Every city fails to resolve** (`matchedCities` ends up empty): throws a real `ValidationError`
 * rather than building a campaign with an empty/absent `geo_locations` — a real, deliberate
 * decision (not a silent fallback): a HOUSING-category ad set with NO geo targeting at all would
 * be a real, broad, non-obviously-broken-looking spend commitment nobody asked for, and Meta's own
 * `specialAdCategories: ['HOUSING']` restriction already strips age/gender as compensating signal,
 * so geo is the only real targeting lever a PROPERTY campaign has left — losing it entirely must
 * be a loud failure, not a quiet no-op.
 *
 * `radiusKm` is clamped into Meta's real accepted kilometer range (17-80 — see `MetaTargetingCity`
 * 's own doc) since `ResolvedLocation.radiusKm` can be smaller (e.g. `0` for
 * `PROPERTY_BRANCH_AUDIENCE_DEFAULTS.UMUM`'s "nationwide" fallback default) or larger than what
 * Meta's API accepts.
 */
export async function resolvePropertyTargeting(
  searchAdLocations: SearchAdLocations,
  resolvedLocation: ResolvedLocation,
  accessToken: string,
): Promise<PropertyTargetingResult> {
  const matchedCities: MatchedPropertyCity[] = [];
  const unresolvedCities: string[] = [];

  for (const city of resolvedLocation.cities) {
    const result = await searchAdLocations.execute({
      query: city,
      locationType: "city",
      accessToken,
    });
    if (!result.ok || result.value.length === 0) {
      unresolvedCities.push(city);
      continue;
    }
    // Tie-break rule (documented above): take the first/most-relevant real Meta result.
    const chosen = result.value[0] as AdLocation;
    matchedCities.push({ query: city, key: chosen.key, name: chosen.name });
  }

  if (matchedCities.length === 0) {
    throw new ValidationError(
      `PROPERTY campaign targeting: none of the resolved cities (${
        resolvedLocation.cities.length > 0 ? resolvedLocation.cities.join(", ") : "<none>"
      }) matched a real Meta location — refusing to create a HOUSING campaign with empty geo targeting.`,
    );
  }

  const radius = Math.min(Math.max(resolvedLocation.radiusKm, MIN_RADIUS_KM), MAX_RADIUS_KM);
  return {
    targeting: {
      geoLocations: {
        cities: matchedCities.slice(0, 1).map((matched) => ({
          key: matched.key,
          radius,
          distanceUnit: "kilometer" as const,
        })),
      },
    },
    matchedCities,
    unresolvedCities,
  };
}
