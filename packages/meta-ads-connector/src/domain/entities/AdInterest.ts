/**
 * One real Meta ad-interest targeting option, as returned by
 * `GET /search?type=adinterest&q=<term>` (AAOS-SIMULASI-TARGETING).
 *
 * `id` is Meta's OWN interest identifier (a numeric string like `"6003304550260"`), not an
 * AAOS-generated id — it is the value Meta's targeting spec expects, and the reason
 * `meta_interests.id` in `apps/aaos-api/supabase/migrations/005_meta_interests.sql` is a
 * `TEXT PRIMARY KEY` rather than a generated UUID.
 *
 * `audienceSizeLower`/`audienceSizeUpper` are Meta's own reported bounds, carried through
 * unmodified — AAOS never estimates, interpolates, or averages an audience size.
 */
export interface AdInterest {
  readonly id: string;
  readonly name: string;
  readonly audienceSizeLower: number;
  readonly audienceSizeUpper: number;
  /** Meta's taxonomy breadcrumb, e.g. `["Interests", "Additional interests", "Used car (vehicle)"]`. */
  readonly path: readonly string[];
  /** Meta's coarse grouping (e.g. `"Business and industry"`). Absent when Meta omits it. */
  readonly topic?: string;
  /** The search term that surfaced this interest — AAOS provenance, not a Meta field. */
  readonly searchTerm: string;
}
