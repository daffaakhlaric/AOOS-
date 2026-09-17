import type { BenchmarkResult } from "../../metric-snapshot/domain/benchmark.js";
import type { SamanthaSignal } from "../../metric-snapshot/domain/signal-engine.js";
import type { MetricSnapshotDto } from "../../metric-snapshot/dto/metric-snapshot.dto.js";

/**
 * EYVRA — SAMANTHA V2 Phase 3. Pure, deterministic "multi-dimension campaign health" — no I/O,
 * no LLM call (see `diagnosis.ts`'s own header doc for why this whole module stays 100%
 * deterministic). Replaces the original raw spec's single FIX/PAUSE/SCALE verdict with 7 named
 * dimensions, each honestly scoped to real data this codebase actually has TODAY:
 *   - `delivery`/`costEfficiency`/`conversion` are real, computed from `MetricSnapshotDto` +
 *     `SamanthaSignal[]` (Phase 1 Part B) — already-shipped real data.
 *   - `creative` is real when the caller had real frequency data to feed `detectSignals`, honestly
 *     `UNKNOWN` when it didn't (never guessed).
 *   - `audience`/`tracking`/`leadQuality` are ALWAYS `UNKNOWN` — this codebase has verified NO real
 *     audience-saturation data, no tracking/pixel-health data, and no CPQL/CRM-stage data anywhere
 *     (only `LeadStatus` NEW/COLD/WARM/HOT/ASSIGNED/CLOSED + numeric `score` — CPQL/appointment/
 *     survey/booking stages are explicitly deferred to a later CRM-overhaul phase). Fabricating a
 *     score for any of these three would be worse than reporting nothing.
 */

export type HealthStatus = "HEALTHY" | "WATCH" | "WARNING" | "CRITICAL" | "UNKNOWN";

export interface HealthDimension {
  readonly status: HealthStatus;
  /** `0`-`100`, real and deterministic — OMITTED (not present) when `status` is `"UNKNOWN"`. Never a fabricated number standing in for "we don't know". */
  readonly score?: number;
  /** `0`-`1`. `0` when `status` is `"UNKNOWN"` — there is genuinely nothing to be confident about. */
  readonly confidence: number;
  /** Indonesian, specific — empty when `status` is `"HEALTHY"`. */
  readonly issues: readonly string[];
}

export type HealthDimensionName =
  | "delivery"
  | "costEfficiency"
  | "creative"
  | "audience"
  | "conversion"
  | "tracking"
  | "leadQuality";

/** Every real `HealthDimensionName` — used by `diagnosis.ts`'s `recommendedFocus` rollup so it iterates the same 7 dimensions this file defines, never a hand-copied second list. */
export const HEALTH_DIMENSION_NAMES: readonly HealthDimensionName[] = [
  "delivery",
  "costEfficiency",
  "creative",
  "audience",
  "conversion",
  "tracking",
  "leadQuality",
];

export interface CampaignHealth {
  readonly delivery: HealthDimension;
  readonly costEfficiency: HealthDimension;
  readonly creative: HealthDimension;
  readonly audience: HealthDimension;
  readonly conversion: HealthDimension;
  readonly tracking: HealthDimension;
  readonly leadQuality: HealthDimension;
  /** Real, deterministic rollup across the 7 dimensions above — see `deriveOverallStatus` below. */
  readonly overallStatus: HealthStatus;
}

export interface CampaignHealthInput {
  /** e.g. this campaign's real `"last_7_days"` `MetricSnapshotDto`. */
  readonly current: MetricSnapshotDto;
  /** From `detectSignals(current, previous, ...)` — already-computed, real signals only. */
  readonly signals: readonly SamanthaSignal[];
  /** From `resolveBenchmark(...)`. */
  readonly benchmark: BenchmarkResult;
  /**
   * Whether the caller actually had a real frequency value to pass as `detectSignals`'
   * `frequencyForFatigue`. `creative` cannot otherwise tell "fatigue genuinely wasn't detected"
   * apart from "frequency data was never available to check" — the caller (the service) is the
   * only one who knows which of those two happened, so it threads the answer explicitly here
   * rather than making this pure function guess from an absent signal alone.
   */
  readonly frequencyDataAvailable: boolean;
}

/** `dataSufficiency.score`/`benchmark`/signal `confidence` are already `0`-`100` or `0`-`1` — this just normalizes the handful of cases this file derives a confidence from scratch. */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// ---------------------------------------------------------------------------------------------
// delivery
// ---------------------------------------------------------------------------------------------

function assessDelivery(
  current: MetricSnapshotDto,
  signals: readonly SamanthaSignal[],
): HealthDimension {
  const sufficiency = current.dataSufficiency;
  const confidence = clamp01(sufficiency.score / 100);

  if (sufficiency.level === "INSUFFICIENT") {
    return {
      status: "UNKNOWN",
      confidence: 0,
      issues: [
        "Data delivery belum cukup untuk dinilai — lihat alasan detail di dataSufficiency.reasons.",
      ],
    };
  }

  const spendWithoutResult = signals.find((signal) => signal.type === "SPEND_WITHOUT_RESULT");
  if (spendWithoutResult !== undefined) {
    return {
      status: "CRITICAL",
      score: sufficiency.score,
      confidence,
      issues: [spendWithoutResult.reasoning],
    };
  }

  if (sufficiency.level === "LOW") {
    return {
      status: "WATCH",
      score: sufficiency.score,
      confidence,
      issues: [
        "Data sufficiency masih LOW — delivery kampanye ini belum bisa dinilai dengan keyakinan penuh.",
      ],
    };
  }

  // MEDIUM / HIGH, no SPEND_WITHOUT_RESULT signal.
  return { status: "HEALTHY", score: sufficiency.score, confidence, issues: [] };
}

// ---------------------------------------------------------------------------------------------
// costEfficiency
// ---------------------------------------------------------------------------------------------

/**
 * Relative-delta thresholds for CPL-vs-benchmark, same order-of-magnitude "~15% is a real,
 * meaningful move" philosophy `signal-engine.ts`'s `CPL_SPIKE_THRESHOLD`/`fatigue.ts`'s
 * `FATIGUED_CTR_TREND_THRESHOLD` already establish — extended here with two further bands
 * (WATCH/WARNING) rather than that file's single spike threshold, because a *dimension score*
 * needs graduated bands where a single point-in-time signal detector does not.
 */
export const COST_EFFICIENCY_HEALTHY_THRESHOLD = 0.15;
export const COST_EFFICIENCY_WATCH_THRESHOLD = 0.4;
export const COST_EFFICIENCY_WARNING_THRESHOLD = 0.8;

function benchmarkConfidenceToNumber(confidence: BenchmarkResult["confidence"]): number {
  switch (confidence) {
    case "HIGH":
      return 1;
    case "MEDIUM":
      return 0.66;
    case "LOW":
      return 0.33;
    default:
      return 0;
  }
}

/** `100` when `current.cpl` is at or below benchmark, sliding down to `0` as the delta approaches/exceeds the WARNING band — a real continuous function of the delta, not a level lookup table. */
function costEfficiencyScore(deltaPct: number): number {
  const score = 100 - Math.max(deltaPct, 0) * (100 / COST_EFFICIENCY_WARNING_THRESHOLD);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function assessCostEfficiency(
  current: MetricSnapshotDto,
  benchmark: BenchmarkResult,
): HealthDimension {
  if (benchmark.confidence === "NONE" || benchmark.cpl === undefined) {
    return {
      status: "UNKNOWN",
      confidence: 0,
      issues: ["Belum ada benchmark CPL yang cukup dipercaya untuk dibandingkan."],
    };
  }

  if (current.cpl === undefined) {
    return {
      status: "UNKNOWN",
      confidence: 0,
      issues: ["Belum ada lead pada periode ini — CPL tidak bisa dihitung."],
    };
  }

  const deltaPct = (current.cpl - benchmark.cpl) / benchmark.cpl;
  const confidence = benchmarkConfidenceToNumber(benchmark.confidence);
  const score = costEfficiencyScore(deltaPct);
  const deltaLabel = `${deltaPct >= 0 ? "+" : ""}${String(Math.round(deltaPct * 100))}%`;

  if (deltaPct <= COST_EFFICIENCY_HEALTHY_THRESHOLD) {
    return { status: "HEALTHY", score, confidence, issues: [] };
  }
  if (deltaPct <= COST_EFFICIENCY_WATCH_THRESHOLD) {
    return {
      status: "WATCH",
      score,
      confidence,
      issues: [
        `CPL saat ini Rp${String(Math.round(current.cpl))} (${deltaLabel} dibanding benchmark Rp${String(Math.round(benchmark.cpl))}) — mulai naik, perlu dipantau.`,
      ],
    };
  }
  if (deltaPct <= COST_EFFICIENCY_WARNING_THRESHOLD) {
    return {
      status: "WARNING",
      score,
      confidence,
      issues: [
        `CPL saat ini Rp${String(Math.round(current.cpl))} (${deltaLabel} dibanding benchmark Rp${String(Math.round(benchmark.cpl))}) — signifikan lebih mahal dari biasanya.`,
      ],
    };
  }
  return {
    status: "CRITICAL",
    score,
    confidence,
    issues: [
      `CPL saat ini Rp${String(Math.round(current.cpl))} (${deltaLabel} dibanding benchmark Rp${String(Math.round(benchmark.cpl))}) — jauh di atas biaya normal.`,
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// creative
// ---------------------------------------------------------------------------------------------

function assessCreative(
  signals: readonly SamanthaSignal[],
  frequencyDataAvailable: boolean,
): HealthDimension {
  if (!frequencyDataAvailable) {
    return {
      status: "UNKNOWN",
      confidence: 0,
      issues: [
        "Data frequency real-time belum tersedia untuk periode ini — creative fatigue belum bisa dinilai.",
      ],
    };
  }

  const fatigue = signals.find((signal) => signal.type === "CREATIVE_FATIGUE");
  if (fatigue === undefined) {
    return { status: "HEALTHY", score: 100, confidence: 1, issues: [] };
  }

  // `signal-engine.ts`'s `detectCreativeFatigue` only ever emits HIGH (FATIGUED) or MEDIUM
  // (WARNING) for this signal type — mapped 1:1 to CRITICAL/WARNING here.
  const status = fatigue.severity === "HIGH" ? "CRITICAL" : "WARNING";
  const score = fatigue.severity === "HIGH" ? 20 : 50;
  return { status, score, confidence: fatigue.confidence, issues: [fatigue.reasoning] };
}

// ---------------------------------------------------------------------------------------------
// audience / tracking / leadQuality — always UNKNOWN, no real data source exists
// ---------------------------------------------------------------------------------------------

function alwaysUnknown(issue: string): HealthDimension {
  return { status: "UNKNOWN", confidence: 0, issues: [issue] };
}

// ---------------------------------------------------------------------------------------------
// conversion
// ---------------------------------------------------------------------------------------------

function assessConversion(
  current: MetricSnapshotDto,
  signals: readonly SamanthaSignal[],
): HealthDimension {
  const sufficiency = current.dataSufficiency;
  if (sufficiency.level === "INSUFFICIENT") {
    return {
      status: "UNKNOWN",
      confidence: 0,
      issues: [
        "Data conversion (CTR) belum cukup untuk dinilai — lihat alasan detail di dataSufficiency.reasons.",
      ],
    };
  }

  const confidence = clamp01(sufficiency.score / 100);
  const drop = signals.find((signal) => signal.type === "CTR_DROP");
  if (drop !== undefined) {
    const status = drop.severity === "HIGH" ? "CRITICAL" : "WARNING";
    const score = drop.severity === "HIGH" ? 20 : 50;
    return { status, score, confidence, issues: [drop.reasoning] };
  }

  // CTR_IMPROVEMENT present, or no CTR signal at all — both are honestly HEALTHY here.
  return { status: "HEALTHY", score: 100, confidence, issues: [] };
}

// ---------------------------------------------------------------------------------------------
// overallStatus rollup
// ---------------------------------------------------------------------------------------------

const STATUS_SEVERITY_RANK: Record<Exclude<HealthStatus, "UNKNOWN">, number> = {
  CRITICAL: 4,
  WARNING: 3,
  WATCH: 2,
  HEALTHY: 1,
};

/**
 * Worst real (non-`UNKNOWN`) status across the 7 dimensions wins (`CRITICAL` > `WARNING` >
 * `WATCH` > `HEALTHY`). When ALL 7 are `UNKNOWN`, `overallStatus` is honestly `UNKNOWN` too —
 * never fabricated as `HEALTHY` from a genuine absence of data.
 */
function deriveOverallStatus(dimensions: readonly HealthDimension[]): HealthStatus {
  const known = dimensions.filter((dimension) => dimension.status !== "UNKNOWN");
  if (known.length === 0) {
    return "UNKNOWN";
  }
  return known.reduce<HealthStatus>((worst, dimension) => {
    if (worst === "UNKNOWN") {
      return dimension.status;
    }
    const worstRank = STATUS_SEVERITY_RANK[worst as Exclude<HealthStatus, "UNKNOWN">];
    const currentRank = STATUS_SEVERITY_RANK[dimension.status as Exclude<HealthStatus, "UNKNOWN">];
    return currentRank > worstRank ? dimension.status : worst;
  }, "UNKNOWN");
}

export function assessCampaignHealth(input: CampaignHealthInput): CampaignHealth {
  const { current, signals, benchmark, frequencyDataAvailable } = input;

  const delivery = assessDelivery(current, signals);
  const costEfficiency = assessCostEfficiency(current, benchmark);
  const creative = assessCreative(signals, frequencyDataAvailable);
  const audience = alwaysUnknown("Data audience-saturation belum tersedia di codebase ini.");
  const conversion = assessConversion(current, signals);
  const tracking = alwaysUnknown("Data tracking/pixel-health belum tersedia di codebase ini.");
  const leadQuality = alwaysUnknown(
    "Data CPQL/tahapan CRM (appointment, survey, booking) belum tersedia — menunggu fase CRM-overhaul berikutnya.",
  );

  const overallStatus = deriveOverallStatus([
    delivery,
    costEfficiency,
    creative,
    audience,
    conversion,
    tracking,
    leadQuality,
  ]);

  return {
    delivery,
    costEfficiency,
    creative,
    audience,
    conversion,
    tracking,
    leadQuality,
    overallStatus,
  };
}
