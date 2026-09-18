/**
 * EYVRA — SAMANTHA V2 Phase 7. Pure budget-pacing math over a Growth Objective's own real
 * `[startDate, endDate]` window vs its real `maxBudgetIdr` ceiling and real, already-summed
 * `actualSpendIdr` — no I/O here (`GrowthObjectivesService.pacing` gathers the real spend before
 * calling this). `today` is injected (never `new Date()` internally), same determinism discipline
 * `GrowthObjectivesService.analyze`'s own date math follows and every other domain function this
 * session establishes (`feasibility.ts`, `campaign-health.ts`, etc.).
 */

export type PacingStatus = "UNDER_PACING" | "ON_PACE" | "OVER_PACING" | "UNKNOWN";

export interface PacingInput {
  /** From `GrowthObjectiveResponseDto.maxBudgetIdr` — `undefined` for GOAL_FIRST objectives with no set ceiling. */
  readonly maxBudgetIdr?: number;
  /** `YYYY-MM-DD`, the objective's own real `start_date`. */
  readonly startDate: string;
  /** `YYYY-MM-DD`, the objective's own real `end_date`. */
  readonly endDate: string;
  /** Injected "now" — see this file's header doc. */
  readonly today: Date;
  /** Real, already-summed spend from `startDate` through `today` (caller computes it). */
  readonly actualSpendIdr: number;
  /**
   * `false` when there were genuinely no matched campaigns to sum spend from (empty
   * `focusListingIds` AND no account-wide fallback attempted, or every matched campaign has zero
   * synced insight rows) — distinct from "spend really is 0" so `PacingResult` can honestly report
   * `UNKNOWN` instead of a fabricated 0-spend pacing verdict.
   */
  readonly spendDataAvailable: boolean;
}

export interface PacingResult {
  /** `UNKNOWN` when `maxBudgetIdr` is undefined OR `spendDataAvailable` is false — never guess a ceiling or a spend number. */
  readonly status: PacingStatus;
  /** Linear pro-rata of `maxBudgetIdr` across `[startDate, endDate]` up to `today`. `undefined` when `status` is `UNKNOWN`. */
  readonly expectedSpendToDateIdr?: number;
  /** Echoed straight through, always real — `0` is a valid real value, distinct from `UNKNOWN`. */
  readonly actualSpendIdr: number;
  /** `actualSpendIdr / expectedSpendToDateIdr`. `undefined` when `expectedSpendToDateIdr` is undefined OR is `0` (never divide by zero). */
  readonly pacingPct?: number;
  /** Real, clamped `>= 0` — `today` may be past `endDate`. */
  readonly daysRemaining: number;
  /** Real, clamped between `0` and the window's total real length — `today` may be before `startDate`. */
  readonly daysElapsed: number;
  /** `(maxBudgetIdr - actualSpendIdr) / daysRemaining` when `daysRemaining > 0`. `undefined` when `daysRemaining` is `0` or `status` is `UNKNOWN`. */
  readonly requiredDailyPaceIdr?: number;
  /** `actualSpendIdr`'s current daily rate (`actualSpendIdr / max(daysElapsed, 1)`) extrapolated across the full window length. `undefined` when `status` is `UNKNOWN`. */
  readonly projectedEndOfPeriodSpendIdr?: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * `±15%` of the pro-rata expected spend counts as `ON_PACE` — same order-of-magnitude "~15% is a
 * real, meaningful move" philosophy `campaign-health.ts`'s `COST_EFFICIENCY_HEALTHY_THRESHOLD`
 * (also `0.15`) and `signal-engine.ts`'s `CPL_SPIKE_THRESHOLD`/`fatigue.ts`'s
 * `FATIGUED_CTR_TREND_THRESHOLD` already establish for this codebase — kept in the same family
 * rather than inventing a different band. Below `1 - PACING_BAND` is `UNDER_PACING` (spending
 * slower than the budget allows — a neutral/informational status, not a warning); above
 * `1 + PACING_BAND` is `OVER_PACING` (real risk of exhausting `maxBudgetIdr` before `endDate`).
 */
export const PACING_BAND = 0.15;

function toDateOnlyMs(dateOnly: string): number {
  return new Date(`${dateOnly}T00:00:00.000Z`).getTime();
}

function todayToDateOnlyMs(today: Date): number {
  return toDateOnlyMs(today.toISOString().slice(0, 10));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeBudgetPacing(input: PacingInput): PacingResult {
  const { maxBudgetIdr, startDate, endDate, today, actualSpendIdr, spendDataAvailable } = input;

  const startMs = toDateOnlyMs(startDate);
  const endMs = toDateOnlyMs(endDate);
  const todayMs = todayToDateOnlyMs(today);

  // Real, inclusive window length in days (a same-day window is a real, honest `1`, never `0`).
  const totalWindowDays = Math.max(1, Math.round((endMs - startMs) / MS_PER_DAY) + 1);

  const daysElapsed = clamp(Math.round((todayMs - startMs) / MS_PER_DAY), 0, totalWindowDays);
  const daysRemaining = clamp(Math.round((endMs - todayMs) / MS_PER_DAY), 0, totalWindowDays);

  if (maxBudgetIdr === undefined || !spendDataAvailable) {
    return {
      status: "UNKNOWN",
      actualSpendIdr,
      daysRemaining,
      daysElapsed,
    };
  }

  const expectedSpendToDateIdr = maxBudgetIdr * (daysElapsed / totalWindowDays);

  // Honest rule for the `expectedSpendToDateIdr === 0` edge (today at/before startDate, so the
  // pro-rata ceiling hasn't opened up yet): zero expected + zero actual is trivially perfectly
  // matched (`ON_PACE`), never a fabricated ratio; zero expected + ANY real spend is a real risk
  // signal (spending before the pro-rata budget even allows it) — `OVER_PACING`, not `UNKNOWN`.
  let status: PacingStatus;
  let pacingPct: number | undefined;
  if (expectedSpendToDateIdr === 0) {
    status = actualSpendIdr === 0 ? "ON_PACE" : "OVER_PACING";
    pacingPct = undefined;
  } else {
    pacingPct = actualSpendIdr / expectedSpendToDateIdr;
    if (pacingPct < 1 - PACING_BAND) {
      status = "UNDER_PACING";
    } else if (pacingPct > 1 + PACING_BAND) {
      status = "OVER_PACING";
    } else {
      status = "ON_PACE";
    }
  }

  const requiredDailyPaceIdr =
    daysRemaining > 0 ? (maxBudgetIdr - actualSpendIdr) / daysRemaining : undefined;
  const projectedEndOfPeriodSpendIdr =
    (actualSpendIdr / Math.max(daysElapsed, 1)) * totalWindowDays;

  return {
    status,
    expectedSpendToDateIdr,
    actualSpendIdr,
    ...(pacingPct !== undefined ? { pacingPct } : {}),
    daysRemaining,
    daysElapsed,
    ...(requiredDailyPaceIdr !== undefined ? { requiredDailyPaceIdr } : {}),
    projectedEndOfPeriodSpendIdr,
  };
}
