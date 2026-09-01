import type { AdLocation } from "../domain/entities/AdLocation.js";
import type { MetaAdLocation } from "../types/MetaApiTypes.js";

/**
 * Maps one (already Zod-validated) raw Meta ad-location search row into the AAOS `AdLocation`
 * entity (AAOS EPIC S, Phase S2) — mirrors `mapAdInterest`'s own discipline: total, lossless-where-
 * it-matters, no defaulting/estimation. Optional Meta fields are simply omitted (never
 * placeholder-filled) when Meta didn't supply them.
 *
 * Like `mapAdInterest`, returns the entity directly rather than a `Result` — every field is a plain
 * string/number/boolean already constrained by `MetaAdLocationSchema`, so there is no failure mode
 * to model here.
 */
export function mapAdLocation(raw: MetaAdLocation, searchQuery: string): AdLocation {
  return {
    key: raw.key,
    name: raw.name,
    type: raw.type,
    countryCode: raw.country_code,
    ...(raw.country_name !== undefined ? { countryName: raw.country_name } : {}),
    ...(raw.region !== undefined ? { region: raw.region } : {}),
    ...(raw.region_id !== undefined ? { regionId: raw.region_id } : {}),
    ...(raw.supports_region !== undefined ? { supportsRegion: raw.supports_region } : {}),
    ...(raw.supports_city !== undefined ? { supportsCity: raw.supports_city } : {}),
    searchQuery,
  };
}
