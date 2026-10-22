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

/** Preserve every resolved city and the approved radius; unsupported plans fail preflight. */
export async function resolvePropertyTargeting(
  searchAdLocations: Pick<SearchAdLocations, "execute">,
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

  // An approved plan must not silently lose locations or widen its radius.
  if (unresolvedCities.length > 0) {
    throw new ValidationError(
      "PRECHECK_FAILED: not every approved city could be resolved; revise the targeting plan.",
    );
  }
  const radius = resolvedLocation.radiusKm;
  if (!Number.isFinite(radius) || radius < MIN_RADIUS_KM || radius > MAX_RADIUS_KM) {
    throw new ValidationError(
      "PRECHECK_FAILED: approved radius is unsupported by this targeting adapter; revise the plan instead of silently clamping it.",
    );
  }
  return {
    targeting: {
      geoLocations: {
        cities: matchedCities.map((matched) => ({
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
