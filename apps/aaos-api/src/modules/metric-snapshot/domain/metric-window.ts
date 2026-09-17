/**
 * EYVRA — SAMANTHA V2 Phase 1 Part B (first half). Real, pure window-to-date-range resolution over
 * `meta_insights_daily`'s per-day `date` column (`050_meta_sync.sql`) — no I/O here, just calendar
 * math. See `../infrastructure/metric-snapshot.repository.ts` for how a resolved range is actually
 * turned into a Supabase query.
 */
export type MetricWindowKey =
  | "today"
  | "yesterday"
  | "last_3_days"
  | "previous_3_days"
  | "last_7_days"
  | "previous_7_days"
  | "last_14_days"
  | "previous_14_days"
  | "last_30_days"
  | "previous_30_days"
  | "lifetime";

/** Every real `MetricWindowKey` value — used by `dto/metric-snapshot.dto.ts`'s Zod schema so the wire-level query param validates against this exact union, never a hand-copied second list. */
export const METRIC_WINDOW_KEYS: readonly MetricWindowKey[] = [
  "today",
  "yesterday",
  "last_3_days",
  "previous_3_days",
  "last_7_days",
  "previous_7_days",
  "last_14_days",
  "previous_14_days",
  "last_30_days",
  "previous_30_days",
  "lifetime",
];

export interface WindowDateRange {
  readonly start: string;
  readonly end: string;
}

/**
 * `YYYY-MM-DD` for a given real `Date`, in UTC — the SAME convention
 * `modules/meta-sync/meta-sync.service.ts`'s `toDateOnly` already establishes for every `date`
 * value this app ever writes into `meta_insights_daily`. Reused verbatim here (not re-invented)
 * so a window's resolved boundaries always compare correctly against that column's real values.
 */
function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBefore(now: Date, days: number): string {
  const copy = new Date(now.getTime());
  copy.setUTCDate(copy.getUTCDate() - days);
  return toDateOnly(copy);
}

/**
 * `"last_N_days"` = the N days ENDING TODAY, inclusive (today itself counts as day 1) — the same
 * convention `MetaSyncRepository.getCampaignDailyHistory`'s existing `days` param already
 * establishes (`since = today - (days - 1)`, no explicit upper bound because "now" already is the
 * upper bound). `"previous_N_days"` is the N days immediately BEFORE that window: no overlap, no
 * gap — if `last_N_days` starts at `today - (N-1)`, `previous_N_days` ends the day right before
 * that (`today - N`) and starts N days earlier still (`today - (2N - 1)`).
 *
 * `"lifetime"` returns `undefined` — no lower bound. The repository layer (see
 * `../infrastructure/metric-snapshot.repository.ts`) omits date filters entirely for `undefined`
 * rather than this function fabricating an arbitrarily old start date.
 */
export function resolveWindowDateRange(
  window: MetricWindowKey,
  now: Date,
): WindowDateRange | undefined {
  switch (window) {
    case "today":
      return { start: toDateOnly(now), end: toDateOnly(now) };
    case "yesterday":
      return { start: daysBefore(now, 1), end: daysBefore(now, 1) };
    case "last_3_days":
      return { start: daysBefore(now, 2), end: toDateOnly(now) };
    case "previous_3_days":
      return { start: daysBefore(now, 5), end: daysBefore(now, 3) };
    case "last_7_days":
      return { start: daysBefore(now, 6), end: toDateOnly(now) };
    case "previous_7_days":
      return { start: daysBefore(now, 13), end: daysBefore(now, 7) };
    case "last_14_days":
      return { start: daysBefore(now, 13), end: toDateOnly(now) };
    case "previous_14_days":
      return { start: daysBefore(now, 27), end: daysBefore(now, 14) };
    case "last_30_days":
      return { start: daysBefore(now, 29), end: toDateOnly(now) };
    case "previous_30_days":
      return { start: daysBefore(now, 59), end: daysBefore(now, 30) };
    case "lifetime":
      return undefined;
  }
}
