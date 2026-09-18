import { HEALTH_DIMENSION_NAMES } from "./campaign-health.js";
import type { CampaignHealth, HealthDimensionName, HealthStatus } from "./campaign-health.js";
import type { SamanthaDecision } from "./decision.js";
import type { CampaignDiagnosis } from "./diagnosis.js";

/**
 * EYVRA — SAMANTHA V2 Phase 10. Pure, deterministic "did this campaign get better or worse since
 * the last recorded checkpoint" comparison over two already-computed `CampaignHealth`/
 * `CampaignDiagnosis`/`SamanthaDecision` triples — no I/O, same discipline `campaign-health.ts`/
 * `diagnosis.ts`/`decision.ts` already establish. `CampaignHealthService.compareLatest` is the only
 * caller — it pulls the two most recent real `samantha_campaign_assessments` rows Phase 6 already
 * persists and hands them here unchanged.
 */

export type DimensionTrend =
  "IMPROVED" | "WORSENED" | "UNCHANGED" | "NEWLY_KNOWN" | "NEWLY_UNKNOWN";
export type RootCauseTrend = "RESOLVED" | "PERSISTED" | "NEW" | "NONE_EITHER_TIME" | "CHANGED";

export interface AssessmentComparisonInput {
  readonly previousHealth: CampaignHealth;
  readonly currentHealth: CampaignHealth;
  readonly previousDiagnosis: CampaignDiagnosis;
  readonly currentDiagnosis: CampaignDiagnosis;
  readonly previousDecision: SamanthaDecision;
  readonly currentDecision: SamanthaDecision;
}

export interface AssessmentComparison {
  readonly dimensionTrends: Readonly<Record<HealthDimensionName, DimensionTrend>>;
  /** Same trend vocabulary as `dimensionTrends`, applied to `overallStatus` itself via the same `trendOf` comparator — never a duplicated ranking. */
  readonly overallStatusTrend: DimensionTrend;
  readonly rootCauseTrend: RootCauseTrend;
  /** Plain `previousDecision.decision !== currentDecision.decision`. */
  readonly decisionChanged: boolean;
  /** Indonesian, one real sentence — see `buildSummary`'s own doc for the chosen priority order. */
  readonly summary: string;
}

/**
 * Best-to-worst ordinal for the 4 REAL (non-`UNKNOWN`) `HealthStatus` values — mirrors
 * `campaign-health.ts`'s own `STATUS_SEVERITY_RANK` (same ordering, inverted direction: here
 * higher is BETTER, there higher is WORSE — kept as a fresh, explicitly-named constant in this
 * file rather than importing and re-inverting that one, so the "higher = better" intent reads
 * directly at the call site).
 */
const STATUS_RANK: Record<Exclude<HealthStatus, "UNKNOWN">, number> = {
  HEALTHY: 4,
  WATCH: 3,
  WARNING: 2,
  CRITICAL: 1,
};

/**
 * `UNKNOWN` is deliberately NOT a point on the `STATUS_RANK` line (see this file's header doc /
 * the phase brief) — it is a different axis entirely ("no data" vs. "data says X"), so it is
 * handled as its own special case here, never compared numerically against a real status.
 */
function trendOf(previous: HealthStatus, current: HealthStatus): DimensionTrend {
  const previousUnknown = previous === "UNKNOWN";
  const currentUnknown = current === "UNKNOWN";

  if (previousUnknown && currentUnknown) {
    return "UNCHANGED";
  }
  if (previousUnknown && !currentUnknown) {
    return "NEWLY_KNOWN";
  }
  if (!previousUnknown && currentUnknown) {
    return "NEWLY_UNKNOWN";
  }

  const previousRank = STATUS_RANK[previous as Exclude<HealthStatus, "UNKNOWN">];
  const currentRank = STATUS_RANK[current as Exclude<HealthStatus, "UNKNOWN">];
  if (currentRank > previousRank) {
    return "IMPROVED";
  }
  if (currentRank < previousRank) {
    return "WORSENED";
  }
  return "UNCHANGED";
}

function computeDimensionTrends(
  previousHealth: CampaignHealth,
  currentHealth: CampaignHealth,
): Record<HealthDimensionName, DimensionTrend> {
  const trends = {} as Record<HealthDimensionName, DimensionTrend>;
  for (const name of HEALTH_DIMENSION_NAMES) {
    trends[name] = trendOf(previousHealth[name].status, currentHealth[name].status);
  }
  return trends;
}

function computeRootCauseTrend(
  previousDiagnosis: CampaignDiagnosis,
  currentDiagnosis: CampaignDiagnosis,
): RootCauseTrend {
  const previousRootCause = previousDiagnosis.rootCause;
  const currentRootCause = currentDiagnosis.rootCause;

  if (previousRootCause === undefined && currentRootCause === undefined) {
    return "NONE_EITHER_TIME";
  }
  if (previousRootCause !== undefined && currentRootCause === undefined) {
    return "RESOLVED";
  }
  if (previousRootCause === undefined && currentRootCause !== undefined) {
    return "NEW";
  }
  return previousRootCause === currentRootCause ? "PERSISTED" : "CHANGED";
}

/** Indonesian label for a `HealthDimensionName`, for the summary sentence only — real, human-readable names, never the raw camelCase key. */
const DIMENSION_LABEL: Record<HealthDimensionName, string> = {
  delivery: "delivery",
  costEfficiency: "efisiensi biaya",
  creative: "creative",
  audience: "audience",
  conversion: "conversion",
  tracking: "tracking",
  leadQuality: "kualitas lead",
};

function worsenedDimensionLabels(
  dimensionTrends: Record<HealthDimensionName, DimensionTrend>,
): string[] {
  return HEALTH_DIMENSION_NAMES.filter((name) => dimensionTrends[name] === "WORSENED").map(
    (name) => DIMENSION_LABEL[name],
  );
}

function improvedDimensionLabels(
  dimensionTrends: Record<HealthDimensionName, DimensionTrend>,
): string[] {
  return HEALTH_DIMENSION_NAMES.filter((name) => dimensionTrends[name] === "IMPROVED").map(
    (name) => DIMENSION_LABEL[name],
  );
}

/**
 * Real, deterministic priority order for the ONE most newsworthy real change to report (never a
 * fabricated/templated-random pick) — evaluated top to bottom:
 *  1. `rootCauseTrend === "RESOLVED"` — the most unambiguously positive real event: whatever was
 *     wrong before no longer has a detectable root cause.
 *  2. `overallStatusTrend === "WORSENED"` — a real regression in the campaign's overall standing
 *     outranks everything below it; a human should see this first.
 *  3. `rootCauseTrend === "NEW"` — a fresh, previously-undetected problem.
 *  4. `rootCauseTrend === "CHANGED"` — the problem is still there but its nature shifted.
 *  5. `overallStatusTrend === "IMPROVED"` — real, worth celebrating, but ranked below any active
 *     problem above so a still-open issue is never buried under good news elsewhere.
 *  6. Individual dimension regressions (`WORSENED`) when overall didn't move — e.g. one dimension
 *     got worse while another improved enough to keep `overallStatus` flat.
 *  7. Individual dimension improvements (`IMPROVED`) when nothing above fired.
 *  8. `decisionChanged` alone (recommendation shifted even though health/diagnosis read as
 *     unchanged by every rule above — a real, reportable event on its own).
 *  9. Honest "tidak ada perubahan berarti" fallback — never fabricated positivity.
 */
function buildSummary(
  dimensionTrends: Record<HealthDimensionName, DimensionTrend>,
  overallStatusTrend: DimensionTrend,
  rootCauseTrend: RootCauseTrend,
  decisionChanged: boolean,
  previousDiagnosis: CampaignDiagnosis,
  currentDiagnosis: CampaignDiagnosis,
): string {
  if (rootCauseTrend === "RESOLVED") {
    return `Root cause sebelumnya (${previousDiagnosis.rootCause ?? "TIDAK DIKETAHUI"}) sudah tidak terdeteksi lagi — kondisi campaign membaik.`;
  }

  if (overallStatusTrend === "WORSENED") {
    return "Status kesehatan campaign secara keseluruhan memburuk dibanding penilaian sebelumnya.";
  }

  if (rootCauseTrend === "NEW") {
    return `Root cause baru terdeteksi: ${currentDiagnosis.rootCause ?? "TIDAK DIKETAHUI"} — sebelumnya belum ada root cause yang jelas.`;
  }

  if (rootCauseTrend === "CHANGED") {
    return `Root cause berubah dari ${previousDiagnosis.rootCause ?? "TIDAK DIKETAHUI"} menjadi ${currentDiagnosis.rootCause ?? "TIDAK DIKETAHUI"}.`;
  }

  if (overallStatusTrend === "IMPROVED") {
    return "Status kesehatan campaign secara keseluruhan membaik dibanding penilaian sebelumnya.";
  }

  const worsened = worsenedDimensionLabels(dimensionTrends);
  if (worsened.length > 0) {
    return `Dimensi ${worsened.join(", ")} memburuk dibanding penilaian sebelumnya, meski overallStatus tidak berubah.`;
  }

  const improved = improvedDimensionLabels(dimensionTrends);
  if (improved.length > 0) {
    return `Dimensi ${improved.join(", ")} membaik dibanding penilaian sebelumnya.`;
  }

  if (decisionChanged) {
    return "Rekomendasi tindakan berubah dibanding penilaian sebelumnya, meski campaign health dan diagnosis tidak menunjukkan perubahan berarti.";
  }

  return "Tidak ada perubahan berarti dibanding penilaian sebelumnya.";
}

export function compareAssessments(input: AssessmentComparisonInput): AssessmentComparison {
  const {
    previousHealth,
    currentHealth,
    previousDiagnosis,
    currentDiagnosis,
    previousDecision,
    currentDecision,
  } = input;

  const dimensionTrends = computeDimensionTrends(previousHealth, currentHealth);
  const overallStatusTrend = trendOf(previousHealth.overallStatus, currentHealth.overallStatus);
  const rootCauseTrend = computeRootCauseTrend(previousDiagnosis, currentDiagnosis);
  const decisionChanged = previousDecision.decision !== currentDecision.decision;
  const summary = buildSummary(
    dimensionTrends,
    overallStatusTrend,
    rootCauseTrend,
    decisionChanged,
    previousDiagnosis,
    currentDiagnosis,
  );

  return { dimensionTrends, overallStatusTrend, rootCauseTrend, decisionChanged, summary };
}
