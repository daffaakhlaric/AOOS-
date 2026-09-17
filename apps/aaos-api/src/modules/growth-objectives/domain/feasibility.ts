import type { ReverseFunnelResult } from "./reverse-funnel.js";

/**
 * EYVRA — SAMANTHA V2 Phase 1 Part B (second half). Pure, deterministic feasibility assessment
 * layered on top of `computeReverseFunnel`'s output — no I/O, same "pure decision function over
 * already-computed signals" shape `evaluateFatigue` (`scheduler/domain/fatigue.ts`) establishes.
 *
 * Decision axis: the DAILY PACE this objective's `reverseFunnel.estimatedRequiredRawLeads.expected`
 * implies (`/ daysRemaining`) vs. the tenant's real current DAILY LEAD CAPACITY, derived from
 * `currentDailySpendCapacityIdr` (real average daily spend, from the account's `last_7_days`
 * snapshot) divided by the IMPLIED cost-per-raw-lead already baked into `reverseFunnel`'s own
 * `estimatedMediaSpendIdr`/`estimatedRequiredRawLeads` ratio — never re-deriving a second CPL from
 * a different source, so the two numbers being compared stay internally consistent.
 */

export type FeasibilityStatus =
  "ACHIEVABLE" | "AGGRESSIVE" | "AT_RISK" | "UNLIKELY" | "INSUFFICIENT_DATA";

export interface FeasibilityInput {
  readonly reverseFunnel: ReverseFunnelResult;
  /** Real days remaining until the objective's `end_date`, already clamped to `>= 0` by the caller. */
  readonly daysRemaining: number;
  readonly maxBudgetIdr?: number;
  /** Real current average daily spend capacity (e.g. `snapshot.spend / snapshot.daysCovered`), from the account's `last_7_days` `MetricSnapshotDto` — caller computes and passes in, this function stays pure. */
  readonly currentDailySpendCapacityIdr?: number;
}

export interface FeasibilityResult {
  readonly status: FeasibilityStatus;
  readonly confidence: number;
  /** Indonesian, specific — mirrors `data-sufficiency.ts`'s reasoning string style/tone. */
  readonly reasons: readonly string[];
  readonly options: readonly (
    "INCREASE_BUDGET" | "REDUCE_TARGET" | "IMPROVE_CONVERSION" | "EXTEND_TIMELINE"
  )[];
}

/** Below this `reverseFunnel.confidence`, the historical sample is too thin (per `reverse-funnel.ts`'s own documented weighting) to responsibly project ANY feasibility verdict — same "too early to trust" philosophy `data-sufficiency.ts`'s `INSUFFICIENT` level already establishes for ad metrics, applied here to lead-volume history. */
export const INSUFFICIENT_DATA_CONFIDENCE_THRESHOLD = 0.15;

/**
 * Pace-vs-capacity ratio thresholds (`dailyPaceNeeded / dailyLeadCapacity`) — same order-of-
 * magnitude "headroom / tight / over / way over" philosophy `fatigue.ts`'s FATIGUED(3.5)/WARNING(2.8)
 * pair establishes (a "tight but real" threshold below a "clearly too much" one), extended here to
 * 3 bands since feasibility has 4 real outcome levels instead of fatigue's 3.
 */
export const ACHIEVABLE_RATIO_THRESHOLD = 0.7;
export const AGGRESSIVE_RATIO_THRESHOLD = 1.0;
export const AT_RISK_RATIO_THRESHOLD = 1.5;

/** Confidence penalty applied when the pacing axis (budget capacity / implied CPL) can't be honestly computed — the verdict is still real, but carries more uncertainty than the reverse funnel's own number alone reflects. */
const PACING_UNCERTAINTY_MULTIPLIER = 0.8;

const STATUS_RANK: Record<FeasibilityStatus, number> = {
  ACHIEVABLE: 0,
  AGGRESSIVE: 1,
  AT_RISK: 2,
  UNLIKELY: 3,
  INSUFFICIENT_DATA: 4,
};

function worseOf(a: FeasibilityStatus, b: FeasibilityStatus): FeasibilityStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

export function assessFeasibility(input: FeasibilityInput): FeasibilityResult {
  const { reverseFunnel, daysRemaining, maxBudgetIdr, currentDailySpendCapacityIdr } = input;

  if (
    reverseFunnel.confidence < INSUFFICIENT_DATA_CONFIDENCE_THRESHOLD ||
    reverseFunnel.estimatedRequiredRawLeads === undefined
  ) {
    return {
      status: "INSUFFICIENT_DATA",
      confidence: reverseFunnel.confidence,
      reasons: [
        reverseFunnel.conversionRate === 0
          ? "Belum ada satupun lead historis yang tergolong Hot Lead — conversion rate 0% tidak bisa dipakai untuk memproyeksikan kebutuhan raw lead."
          : "Data historis raw lead/hot lead masih terlalu sedikit untuk memproyeksikan feasibility secara bertanggung jawab.",
      ],
      options: [],
    };
  }

  const required = reverseFunnel.estimatedRequiredRawLeads;
  const reasons: string[] = [];
  const options = new Set<
    "INCREASE_BUDGET" | "REDUCE_TARGET" | "IMPROVE_CONVERSION" | "EXTEND_TIMELINE"
  >();

  if (daysRemaining === 0) {
    reasons.push(
      "Sisa waktu objective ini sudah 0 hari (tanggal akhir sudah tercapai atau lewat) — target tidak realistis dikejar dalam window saat ini.",
    );
    options.add("EXTEND_TIMELINE");
    if (reverseFunnel.conversionRate !== undefined && reverseFunnel.conversionRate < 1) {
      options.add("REDUCE_TARGET");
    }
    return {
      status: "UNLIKELY",
      confidence: reverseFunnel.confidence * PACING_UNCERTAINTY_MULTIPLIER,
      reasons,
      options: [...options],
    };
  }

  const dailyPaceNeeded = required.expected / daysRemaining;

  let impliedCplIdr: number | undefined;
  if (reverseFunnel.estimatedMediaSpendIdr !== undefined && required.expected > 0) {
    impliedCplIdr = reverseFunnel.estimatedMediaSpendIdr.expected / required.expected;
  }

  let dailyLeadCapacity: number | undefined;
  if (
    currentDailySpendCapacityIdr !== undefined &&
    impliedCplIdr !== undefined &&
    impliedCplIdr > 0
  ) {
    dailyLeadCapacity = currentDailySpendCapacityIdr / impliedCplIdr;
  }

  let status: FeasibilityStatus;
  let pacingUncertain = false;

  if (dailyLeadCapacity === undefined) {
    // No real budget-capacity/CPL basis to compare pace against — the projection itself is real,
    // but we can't honestly confirm it's ACHIEVABLE on the current spend trajectory. Default to
    // AGGRESSIVE (proceed, but flagged as unconfirmed) rather than the falsely-reassuring
    // ACHIEVABLE, or the falsely-alarming UNLIKELY.
    status = "AGGRESSIVE";
    pacingUncertain = true;
    reasons.push(
      "Kapasitas spend harian atau CPL historis belum cukup untuk membandingkan pace kebutuhan raw lead — status pacing belum bisa dikonfirmasi.",
    );
  } else {
    const ratio = dailyPaceNeeded / dailyLeadCapacity;
    if (ratio <= ACHIEVABLE_RATIO_THRESHOLD) {
      status = "ACHIEVABLE";
      reasons.push(
        `Kebutuhan pace ${dailyPaceNeeded.toFixed(1)} raw lead/hari masih jauh di bawah kapasitas saat ini (${dailyLeadCapacity.toFixed(1)} raw lead/hari).`,
      );
    } else if (ratio <= AGGRESSIVE_RATIO_THRESHOLD) {
      status = "AGGRESSIVE";
      reasons.push(
        `Kebutuhan pace ${dailyPaceNeeded.toFixed(1)} raw lead/hari mendekati batas kapasitas saat ini (${dailyLeadCapacity.toFixed(1)} raw lead/hari) — tidak ada banyak ruang gerak.`,
      );
    } else if (ratio <= AT_RISK_RATIO_THRESHOLD) {
      status = "AT_RISK";
      reasons.push(
        `Kebutuhan pace ${dailyPaceNeeded.toFixed(1)} raw lead/hari melebihi kapasitas saat ini (${dailyLeadCapacity.toFixed(1)} raw lead/hari).`,
      );
      options.add("INCREASE_BUDGET");
      options.add("IMPROVE_CONVERSION");
      options.add("EXTEND_TIMELINE");
    } else {
      status = "UNLIKELY";
      reasons.push(
        `Kebutuhan pace ${dailyPaceNeeded.toFixed(1)} raw lead/hari jauh melebihi kapasitas saat ini (${dailyLeadCapacity.toFixed(1)} raw lead/hari).`,
      );
      options.add("INCREASE_BUDGET");
      options.add("REDUCE_TARGET");
      options.add("IMPROVE_CONVERSION");
      options.add("EXTEND_TIMELINE");
    }
  }

  if (
    maxBudgetIdr !== undefined &&
    reverseFunnel.estimatedMediaSpendIdr !== undefined &&
    reverseFunnel.estimatedMediaSpendIdr.expected > maxBudgetIdr
  ) {
    reasons.push(
      `Estimasi media spend (Rp${String(reverseFunnel.estimatedMediaSpendIdr.expected)}) melebihi max budget yang ditetapkan (Rp${String(maxBudgetIdr)}).`,
    );
    options.add("INCREASE_BUDGET");
    options.add("REDUCE_TARGET");
    status = worseOf(status, "AT_RISK");
  }

  const confidence = pacingUncertain
    ? reverseFunnel.confidence * PACING_UNCERTAINTY_MULTIPLIER
    : reverseFunnel.confidence;

  return { status, confidence, reasons, options: [...options] };
}
