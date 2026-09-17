import type { SupabaseClientLike } from "@aos/lead-store";

import type { EvaluatableLead } from "../../hot-lead-definitions/domain/evaluate-hot-lead.js";

const TABLE = "leads";

/** Raw `leads` row shape this repository reads — just the columns `computeReverseFunnel`'s inputs and `evaluateHotLead` need, COLUMN-FOR-COLUMN with `packages/lead-store/supabase/migrations/001_initial_schema.sql`. */
interface LeadHotEvaluationRow {
  readonly status: string;
  readonly score: number;
  readonly qual_budget: boolean;
  readonly qual_unit: boolean;
  readonly qual_area: boolean;
  readonly qual_payment: boolean;
  readonly qual_timeline: boolean;
  readonly qual_name: boolean;
}

export class GrowthMetricsRepositoryError extends Error {}

/**
 * Practical POC-scale cap for `listLeadsForHotEvaluation`'s fetch — the shared `SupabaseClientLike`
 * port (`@aos/lead-store`'s `SupabaseTypes.ts`) has no `count: 'exact', head: true` support to push
 * a real server-side count down to the database (verified: `SupabaseFilterBuilderLike` declares only
 * `select`/`eq`/`gte`/`lte`/`order`/`limit`/`single`/`maybeSingle`), so BOTH methods on this
 * repository fetch real rows (not a native count) up to this cap and derive their number from what
 * comes back — same honest tradeoff `BroadcastLogRepository.getTodaySummary`'s own
 * `TODAY_SUMMARY_FETCH_LIMIT` already documents for an analogous "no native count" gap. A tenant
 * whose real raw-lead volume in the lookback window exceeds this cap will get an honestly
 * UNDER-counted `countRawLeads`/`listLeadsForHotEvaluation` result, never a silently wrong one —
 * documented here rather than fixed by inventing a `count` option the underlying port doesn't have.
 * Pagination for correctness at real scale is a real, deferred follow-up (out of scope for this
 * phase — no `aaos-api` tenant is anywhere near this volume yet).
 */
export const LEADS_FETCH_LIMIT = 5_000;

/**
 * Supabase-backed READ-ONLY reads over the real `leads` table (`packages/lead-store`'s own schema)
 * for EYVRA — SAMANTHA V2 Phase 1 Part B's Reverse Funnel domain. Deliberately a NEW, lightweight
 * repository directly in `aaos-api` (mirrors `listing.repository.ts`'s plain-class-over-
 * `SupabaseClientLike` pattern) rather than a change to `packages/lead-store` itself — that package
 * is a shared domain package other consumers depend on, out of scope for this phase to modify.
 *
 * Both methods are tenant-scoped via `.eq("tenant_id", tenantId)`, same discipline every other
 * repository this phase touches already establishes, and both filter `created_at` to `[since, until]`
 * — a CLOSED (inclusive-inclusive) window, not a true half-open one: the shared `SupabaseClientLike`
 * port (`@aos/lead-store`'s `SupabaseTypes.ts`) declares only `gte`/`lte`, no `lt`, so an exclusive
 * upper bound isn't expressible here. Callers should pass `until` as the real inclusive end of the
 * window they mean (e.g. an ISO timestamp for "end of day"), same convention
 * `metric-snapshot.repository.ts`'s own `applyDateRange` already uses for this exact
 * gte/lte-only port.
 */
export class GrowthMetricsRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /**
   * Real count of `leads` rows for this tenant with `created_at` in `[since, until]`. See this
   * file's header doc for why this is a real row-count fetch (capped at `LEADS_FETCH_LIMIT`), not a
   * native database `count: 'exact'` — the shared `SupabaseClientLike` port has no such option.
   */
  async countRawLeads(tenantId: string, since: string, until: string): Promise<number> {
    const { data, error } = await this.client
      .from<{ readonly id: string }>(TABLE)
      .select("id")
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .lte("created_at", until)
      .limit(LEADS_FETCH_LIMIT);
    if (error !== null) {
      throw new GrowthMetricsRepositoryError(
        `GrowthMetricsRepository.countRawLeads failed: ${error.message}`,
      );
    }
    return (data ?? []).length;
  }

  /**
   * Every `leads` row for this tenant in `[since, until]`, mapped to `evaluate-hot-lead.ts`'s real
   * `EvaluatableLead` shape — capped at `LEADS_FETCH_LIMIT` (see this file's header doc). Hotness
   * itself is NEVER evaluated in SQL here — the caller runs each row through the real, pure
   * `evaluateHotLead` in application code, per `hot-lead-definitions`' own established discipline
   * (see that module's `domain/evaluate-hot-lead.ts`).
   */
  async listLeadsForHotEvaluation(
    tenantId: string,
    since: string,
    until: string,
  ): Promise<readonly EvaluatableLead[]> {
    const { data, error } = await this.client
      .from<LeadHotEvaluationRow>(TABLE)
      .select(
        "status, score, qual_budget, qual_unit, qual_area, qual_payment, qual_timeline, qual_name",
      )
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .lte("created_at", until)
      .limit(LEADS_FETCH_LIMIT);
    if (error !== null) {
      throw new GrowthMetricsRepositoryError(
        `GrowthMetricsRepository.listLeadsForHotEvaluation failed: ${error.message}`,
      );
    }
    return (data ?? []).map((row) => ({
      status: row.status,
      score: row.score,
      qualification: {
        budget: row.qual_budget,
        unit: row.qual_unit,
        area: row.qual_area,
        payment: row.qual_payment,
        timeline: row.qual_timeline,
        name: row.qual_name,
      },
    }));
  }
}
