import type { Lead, LeadQualificationFlags } from "@aos/lead-store";

/**
 * AAOS-TAMARA-INTELLIGENCE-LAYER Phase 1 ("Source 6: Hot Lead Patterns"). Pure — receives
 * already-fetched `Lead[]` (e.g. from `@aos/lead-store`'s real `GetHotLeads` use case), never
 * queries Supabase itself.
 *
 * Per the wider effort's coordinator note point 3 (confirmed via direct read of
 * `packages/lead-store/src/domain/entities/Lead.ts` / `supabase/migrations/001_initial_schema.sql`):
 * the real `leads` table/entity has NO `area_mentioned`, `payment_type`, or `unit_interested`
 * free-text columns — only `branchId` and the 6 boolean `LeadQualificationFlags`
 * (`budget/unit/area/payment/timeline/name`). The spec's `topArea`/`topPayment`/`topUnit` (mined
 * from those nonexistent columns) and `extractTopQuestions`/`extractObjections` (mined from
 * message free text, which would need a real, separate LLM-extraction step — out of scope here,
 * see coordinator note) are REPLACED by what the real data can honestly support:
 * `qualificationCompletionRate` — the fraction of the given leads with each qualification flag
 * `true`, a real proxy for "how often does X come up in conversation" (e.g. a high `payment`
 * completion rate is real evidence payment method is commonly discussed/resolved — NOT "80%
 * prefer KPR", which the data cannot say). Timing (`peakHour`/`peakDay`) IS real — both are
 * derived from `Lead.createdAt`, a real column.
 */
export interface LeadIntelSignal {
  readonly totalLeads: number;
  readonly avgScore: number;
  /** `branchId` (stringified) -> lead count, sorted descending. */
  readonly topBranches: ReadonlyArray<{ readonly branchId: string; readonly count: number }>;
  /** Fraction (0-1) of `leads` with each qualification flag `true`. */
  readonly qualificationCompletionRate: Record<keyof LeadQualificationFlags, number>;
  /** Most common hour-of-day (0-23, local time of `createdAt`) leads arrived. `undefined` for an empty input. */
  readonly peakHour: number | undefined;
  /** Most common day-of-week (0=Sunday..6=Saturday, local time of `createdAt`). `undefined` for an empty input. */
  readonly peakDay: number | undefined;
}

const QUALIFICATION_KEYS: ReadonlyArray<keyof LeadQualificationFlags> = [
  "budget",
  "unit",
  "area",
  "payment",
  "timeline",
  "name",
];

/** The most frequent value in `values`, or `undefined` for an empty array. Ties break toward the first-encountered value (stable `Map` insertion order). */
function mostCommon(values: ReadonlyArray<number>): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: number | undefined;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export class LeadIntelService {
  static getHotLeadProfile(leads: ReadonlyArray<Lead>): LeadIntelSignal {
    const totalLeads = leads.length;

    const avgScore =
      totalLeads === 0 ? 0 : leads.reduce((sum, lead) => sum + lead.score, 0) / totalLeads;

    const branchCounts = new Map<string, number>();
    for (const lead of leads) {
      const key = String(lead.branchId);
      branchCounts.set(key, (branchCounts.get(key) ?? 0) + 1);
    }
    const topBranches = [...branchCounts.entries()]
      .map(([branchId, count]) => ({ branchId, count }))
      .sort((a, b) => b.count - a.count);

    const qualificationCompletionRate = Object.fromEntries(
      QUALIFICATION_KEYS.map((key) => [
        key,
        totalLeads === 0 ? 0 : leads.filter((lead) => lead.qualification[key]).length / totalLeads,
      ]),
    ) as Record<keyof LeadQualificationFlags, number>;

    const hours = leads.map((lead) => lead.createdAt.getHours());
    const days = leads.map((lead) => lead.createdAt.getDay());

    return {
      totalLeads,
      avgScore,
      topBranches,
      qualificationCompletionRate,
      peakHour: mostCommon(hours),
      peakDay: mostCommon(days),
    };
  }
}
