/**
 * Meta `GET /search?type=adgeolocation&location_types=["city"]` rows used as MSW fixtures for
 * AAOS EPIC S, Phase S2.
 *
 * HONEST PROVENANCE NOTE (unlike `ad-interest-fixtures.ts`'s live-captured rows): no live Meta
 * Marketing API access token was available in this environment, so these rows are NOT captured
 * from a real live call. `manhattanUS`/`manhattanKS` are taken verbatim from Meta's own documented
 * example response in the "Targeting Search" reference
 * (developers.facebook.com/docs/marketing-api/audiences/reference/targeting-search) — a real,
 * genuine multi-region-ambiguity example Meta itself publishes (two distinct real US places named
 * "Manhattan": the NYC borough and a Kansas city). `bandung`/`jakarta` are structurally identical
 * rows (same field set, same types) built for an Indonesian PROPERTY-vertical city name this
 * codebase's own `ResolvedLocation.cities` realistically produces — their `key` values are
 * plausible-shaped placeholders for test purposes only and must NOT be treated as real Meta ids.
 */
export const REAL_AD_LOCATION_ROWS = {
  manhattanKS: {
    key: "2447439",
    name: "Manhattan",
    type: "city",
    country_code: "US",
    country_name: "United States",
    region: "Kansas",
    region_id: 3859,
    supports_region: true,
    supports_city: true,
  },
  manhattanNY: {
    key: "2418779",
    name: "Manhattan",
    type: "city",
    country_code: "US",
    country_name: "United States",
    region: "New York",
    region_id: 3875,
    supports_region: true,
    supports_city: true,
  },
  bandung: {
    key: "1109310",
    name: "Bandung",
    type: "city",
    country_code: "ID",
    country_name: "Indonesia",
    region: "West Java",
    region_id: 1533,
    supports_region: true,
    supports_city: true,
  },
} as const;
