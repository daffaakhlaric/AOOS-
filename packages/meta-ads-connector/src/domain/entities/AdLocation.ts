/**
 * One real Meta location targeting option, as returned by
 * `GET /search?type=adgeolocation&location_types=["city"]&q=<name>` (AAOS EPIC S, Phase S2).
 *
 * `key` is Meta's OWN location identifier (a numeric string like `"2447439"`), not an
 * AAOS-generated id — it is the value Meta's `targeting.geo_locations.cities[].key` expects (see
 * `IMetaAdsClient.MetaTargetingCity`), mirroring `AdInterest.id`'s own "Meta's id, not ours"
 * discipline.
 */
export interface AdLocation {
  readonly key: string;
  readonly name: string;
  /** Meta's location type for this row, e.g. `"city"` (also `"subcity"` for boroughs/neighborhoods Meta reclassifies under a city search). */
  readonly type: string;
  readonly countryCode: string;
  readonly countryName?: string;
  /** Parent region/state name, e.g. `"Kansas"`. Absent when Meta omits it. */
  readonly region?: string;
  readonly regionId?: number;
  readonly supportsRegion?: boolean;
  readonly supportsCity?: boolean;
  /** The free-text query that surfaced this location — AAOS provenance, not a Meta field. */
  readonly searchQuery: string;
}
