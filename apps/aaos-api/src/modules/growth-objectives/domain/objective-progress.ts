/**
 * EYVRA — SAMANTHA V2 Phase 8. Pure real-progress math over a Growth Objective's own real
 * `[startDate, endDate]` window vs its real `targetHotLeads` and real `achievedHotLeads` (real Hot
 * Lead count since the objective's own `start_date`, computed by
 * `GrowthObjectivesService.checkProgress` — never here; this file does no I/O). `today` is injected
 * (never `new Date()` internally), same determinism discipline `domain/pacing.ts` (Phase 7) already
 * establishes for this module and every other domain function this session establishes
 * (`feasibility.ts`, `campaign-health.ts`, etc.).
 *
 * This is the RUNTIME counterpart to `GrowthObjectivesService.analyze()`'s FORECAST: `analyze()`
 * estimates what an objective could achieve, over a fixed 30-day historical lookback, BEFORE it
 * starts running (`DRAFT`/`REPLANNING` -> `PLANNED`). This file measures what an ACTIVE (or
 * already-`ON_TRACK`/`AT_RISK`/`OFF_TRACK`) objective has REALLY achieved so far, over its own real
 * `[start_date, today]` window — a genuinely different question, so it is a genuinely different
 * function, not a variant of `computeReverseFunnel`/`assessFeasibility`.
 */

export type ObjectiveProgressStatus = "COMPLETED" | "ON_TRACK" | "AT_RISK" | "OFF_TRACK";

export interface ObjectiveProgressInput {
  /** The objective's own real `target_value` — always a real positive integer per `054_growth_objectives.sql`'s own CHECK constraint, never `undefined`/`0` here (unlike `pacing.ts`'s `maxBudgetIdr`, which is genuinely optional). */
  readonly targetHotLeads: number;
  /** Real count of Hot Leads (per the tenant's own `HotLeadDefinition`, evaluated via `evaluateHotLead`) since the objective's own real `startDate` through `today` — the caller's job, not this function's. */
  readonly achievedHotLeads: number;
  /** `YYYY-MM-DD`, the objective's own real `start_date`. */
  readonly startDate: string;
  /** `YYYY-MM-DD`, the objective's own real `end_date`. */
  readonly endDate: string;
  /** Injected "now" — see this file's header doc. */
  readonly today: Date;
}

export interface ObjectiveProgressResult {
  readonly status: ObjectiveProgressStatus;
  /** `achievedHotLeads / targetHotLeads` — always real and computable, see `targetHotLeads`'s own doc above. */
  readonly progressPct: number;
  /** Real, clamped between `0` and the window's total real length — `today` may be before `startDate`. */
  readonly daysElapsed: number;
  /** Real, clamped `>= 0` — `today` may be past `endDate`. */
  readonly daysRemaining: number;
  /** `achievedHotLeads / max(daysElapsed, 1)`. */
  readonly currentDailyPace: number;
  /** `(targetHotLeads - achievedHotLeads) / daysRemaining` when `daysRemaining > 0` AND the target isn't already reached. `undefined` when `daysRemaining` is `0` or `achievedHotLeads >= targetHotLeads` — nothing real left to pace toward. */
  readonly requiredDailyPace?: number;
  /** `currentDailyPace * totalWindowDays` — the real, honest linear extrapolation, same shape `pacing.ts`'s `projectedEndOfPeriodSpendIdr` uses. */
  readonly projectedFinalCount: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * `projectedFinalCount / targetHotLeads` cut points for the not-yet-completed, window-still-open
 * branch: `>= 0.9` -> `ON_TRACK`, `>= 0.5` -> `AT_RISK`, below `0.5` -> `OFF_TRACK`. Deliberately NOT
 * the same shape as `pacing.ts`'s `PACING_BAND` (a symmetric `±15%` band around 100% pacing —
 * "is real spend close to the pro-rata expected amount, in either direction"). Real Hot Lead
 * achievement has no meaningful "too far ahead" failure mode — a projection well above target is
 * unambiguously good, never a risk signal — so this is a one-sided "how close to the real goal is
 * the current pace projected to land" gate instead: comfortably close (`>= 0.9`) is `ON_TRACK`,
 * meaningfully behind but not hopeless (`>= 0.5`) is `AT_RISK`, projected to miss by more than half
 * is `OFF_TRACK`. Two different real questions, two honestly different bands.
 */
export const ON_TRACK_PROJECTION_RATIO = 0.9;
export const AT_RISK_PROJECTION_RATIO = 0.5;

function toDateOnlyMs(dateOnly: string): number {
  return new Date(`${dateOnly}T00:00:00.000Z`).getTime();
}

function todayToDateOnlyMs(today: Date): number {
  return toDateOnlyMs(today.toISOString().slice(0, 10));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeObjectiveProgress(input: ObjectiveProgressInput): ObjectiveProgressResult {
  const { targetHotLeads, achievedHotLeads, startDate, endDate, today } = input;

  const startMs = toDateOnlyMs(startDate);
  const endMs = toDateOnlyMs(endDate);
  const todayMs = todayToDateOnlyMs(today);

  // Real, inclusive window length in days (a same-day window is a real, honest `1`, never `0`) —
  // same guard `pacing.ts`'s `totalWindowDays` already establishes.
  const totalWindowDays = Math.max(1, Math.round((endMs - startMs) / MS_PER_DAY) + 1);

  const daysElapsed = clamp(Math.round((todayMs - startMs) / MS_PER_DAY), 0, totalWindowDays);
  const daysRemaining = clamp(Math.round((endMs - todayMs) / MS_PER_DAY), 0, totalWindowDays);

  const progressPct = achievedHotLeads / targetHotLeads;
  const currentDailyPace = achievedHotLeads / Math.max(daysElapsed, 1);
  const projectedFinalCount = currentDailyPace * totalWindowDays;

  const targetReached = achievedHotLeads >= targetHotLeads;

  const requiredDailyPace =
    daysRemaining > 0 && !targetReached
      ? (targetHotLeads - achievedHotLeads) / daysRemaining
      : undefined;

  let status: ObjectiveProgressStatus;
  if (targetReached) {
    // Rule 1: the real goal is already met, regardless of dates — checked FIRST, before any
    // date-based branch, so an objective that hits its target early is honestly `COMPLETED`
    // immediately, not still "ON_TRACK" until `endDate`.
    status = "COMPLETED";
  } else if (daysRemaining === 0) {
    // Rule 2: the window has ended without reaching target — a real, final "missed" state.
    status = "OFF_TRACK";
  } else {
    // Rule 3: window still open — compare the real linear projection against the real target.
    const projectionRatio = projectedFinalCount / targetHotLeads;
    if (projectionRatio >= ON_TRACK_PROJECTION_RATIO) {
      status = "ON_TRACK";
    } else if (projectionRatio >= AT_RISK_PROJECTION_RATIO) {
      status = "AT_RISK";
    } else {
      status = "OFF_TRACK";
    }
  }

  return {
    status,
    progressPct,
    daysElapsed,
    daysRemaining,
    currentDailyPace,
    ...(requiredDailyPace !== undefined ? { requiredDailyPace } : {}),
    projectedFinalCount,
  };
}
