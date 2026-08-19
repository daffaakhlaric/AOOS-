import { z } from "zod";

/**
 * The curated real search terms `POST /api/v1/meta-interests/sync` runs when the caller supplies
 * none. Every term here was CONFIRMED LIVE against the real Meta Graph API on 2026-08-18 to return
 * real, DSS-Motor-relevant interest rows — none is a guess:
 *
 * - `"automotive"` → Automotive industry (industry)
 * - `"used car"`   → Used car (vehicle)            ← DSS Motor's actual business
 * - `"car finance"`→ car finance (credit and lending)
 * - `"vehicle"`    → Vehicles (transportation)
 * - `"family"`     → Family (social concept)       ← the PRIMARY_FAMILY target persona
 *
 * Deliberately NOT extended with extra plausible-sounding terms ("mobil bekas", "kredit mobil",
 * "MPV", …): those have not been run against the live API in this environment, and a term that
 * returns nothing would quietly narrow the catalogue while looking like it worked. A human can
 * pass any term explicitly via the request body's `terms` to try more.
 */
export const CURATED_INTEREST_SEARCH_TERMS: readonly string[] = [
  "automotive",
  "used car",
  "car finance",
  "vehicle",
  "family",
];

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 (spec Part 11's `INTERESTS_BY_VERTICAL.PROPERTY`)
 * — the PROPERTY vertical's sibling search-term list, following the SAME "real search terms run
 * against the live Meta Graph API, never a fabricated numeric interest id" discipline
 * `CURATED_INTEREST_SEARCH_TERMS` establishes.
 *
 * ⚠ UNLIKE `CURATED_INTEREST_SEARCH_TERMS` (every term there confirmed live 2026-08-18), these
 * terms have NOT yet been run against the live Meta Graph API in this environment — they are the
 * spec's own named PROPERTY interest categories ("Real estate", "Property investment", "House",
 * "Apartment", "Mortgage/KPR", "Home improvement", "Interior design", "Home decoration", "Land
 * investment", "Residential area"), transcribed as literal search terms for `SearchAdInterests`.
 * `MetaInterestsService.sync` still only ever writes what Meta's real API actually returns for a
 * term — an unconfirmed term that returns nothing simply yields zero rows for that term (reported
 * per-term, per the class doc's FAILURE POLICY), never a fabricated result. A human should run a
 * real sync and confirm these before relying on the catalogue for a live PropertyKlik campaign.
 */
export const CURATED_PROPERTY_INTEREST_SEARCH_TERMS: readonly string[] = [
  "real estate",
  "property investment",
  "house",
  "apartment",
  "mortgage",
  "home improvement",
  "interior design",
  "home decoration",
  "land investment",
  "residential area",
];

/** Spec Part 11's `INTERESTS_BY_VERTICAL` map — which curated term list `sync` defaults to per tenant vertical. */
export const INTERESTS_BY_VERTICAL: Readonly<Record<"AUTOMOTIVE" | "PROPERTY", readonly string[]>> =
  {
    AUTOMOTIVE: CURATED_INTEREST_SEARCH_TERMS,
    PROPERTY: CURATED_PROPERTY_INTEREST_SEARCH_TERMS,
  };

/**
 * `POST /api/v1/meta-interests/sync` request body. Everything is optional: the no-body case runs
 * `INTERESTS_BY_VERTICAL[vertical]` (defaulting to `AUTOMOTIVE`, this app's real single-tenant
 * bootstrap default — see `common/tenant-context.ts`'s `DEFAULT_TENANT_ID` doc for the same
 * rationale), which is the intended manual/cron-by-hand usage.
 */
export const SyncInterestsBodySchema = z.object({
  /** Overrides `INTERESTS_BY_VERTICAL[vertical]` for this run. */
  terms: z.array(z.string().min(1)).min(1).optional(),
  /** Which curated term list to default to when `terms` is omitted. Ignored when `terms` is supplied. */
  vertical: z.enum(["AUTOMOTIVE", "PROPERTY"]).optional(),
  /** Caps how many interests are kept per term; defaults to the connector's `MAX_INTERESTS_PER_TERM`. */
  limitPerTerm: z.number().int().min(1).max(50).optional(),
});
export type SyncInterestsBodyDto = z.infer<typeof SyncInterestsBodySchema>;

/** Per-term outcome — a term whose real Meta call failed is reported honestly, never silently skipped. */
export interface SyncInterestsTermResultDto {
  readonly term: string;
  readonly ok: boolean;
  readonly error?: string;
  readonly found: number;
  readonly inserted: number;
  readonly updated: number;
}

export interface SyncInterestsResponseDto {
  readonly tenantId: string;
  readonly fetchedAt: string;
  readonly terms: readonly SyncInterestsTermResultDto[];
  readonly totalInserted: number;
  readonly totalUpdated: number;
}

/** `GET /api/v1/meta-interests` — the stored catalogue, for inspecting what a sync really produced. */
export interface MetaInterestResponseDto {
  readonly id: string;
  readonly name: string;
  readonly audienceSizeLower: number;
  readonly audienceSizeUpper: number;
  readonly path: readonly string[];
  readonly topic?: string;
  readonly searchTerm: string;
  readonly fetchedAt: string;
}
