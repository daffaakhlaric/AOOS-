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
 * `POST /api/v1/meta-interests/sync` request body. Everything is optional: the no-body case runs
 * the curated confirmed-live term list above, which is the intended manual/cron-by-hand usage.
 */
export const SyncInterestsBodySchema = z.object({
  /** Overrides `CURATED_INTEREST_SEARCH_TERMS` for this run. */
  terms: z.array(z.string().min(1)).min(1).optional(),
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
