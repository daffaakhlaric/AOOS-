import { evaluateFatigue } from "../../scheduler/domain/fatigue.js";
import type { MetricSnapshotDto } from "../dto/metric-snapshot.dto.js";

import type { DataSufficiencyResult } from "./data-sufficiency.js";

/**
 * EYVRA — SAMANTHA V2 Phase 1 Part B (second half). Pure Signal Engine — no I/O; every input is
 * already-fetched/already-computed real data the caller assembles (two real `MetricSnapshotDto`
 * windows + their `DataSufficiencyResult`, optionally a real current frequency for creative
 * fatigue). Same "pure domain function over already-fetched rows" shape `computeReverseFunnel`/
 * `assessFeasibility`/`evaluateFatigue` already establish.
 *
 * DELIBERATELY-SCOPED SUBSET — real data this codebase can actually compute TODAY, not a
 * placeholder for the raw SAMANTHA V2 spec's full ~20-signal catalogue. This file implements only
 * the 7 signal types listed in `SamanthaSignalType` below, each backed by a real, already-existing
 * data source in this codebase:
 *   - CTR_DROP/CTR_IMPROVEMENT, CPL_SPIKE/CPL_IMPROVEMENT, FREQUENCY_RISE, SPEND_WITHOUT_RESULT —
 *     all computed from two real `MetricSnapshotDto` windows (`aggregate-insights.ts`'s real
 *     `ctr`/`cpl`/`frequency`/`spend`/`leads`).
 *   - CREATIVE_FATIGUE — delegates straight to the EXISTING `evaluateFatigue`
 *     (`scheduler/domain/fatigue.ts`), never reimplemented here.
 *   - INSUFFICIENT_DATA — the short-circuit signal when `dataSufficiency.level === "INSUFFICIENT"`.
 * Explicitly NOT implemented (no real data source anywhere in this codebase today, verified):
 * CPQL_SPIKE (no "qualified lead" concept — see `054_growth_objectives.sql`'s header doc (a)),
 * AUDIENCE_SATURATION, PLACEMENT_ANOMALY, TRACKING_DEGRADATION, LEARNING_LIMITED, and the rest of
 * the raw spec's ~20-signal catalogue. Adding any of those requires a real new data source first,
 * not a fabricated placeholder signal here.
 *
 * OUT OF SCOPE FOR THIS PHASE: no controller/persistence for signals — no `samantha_signals` table,
 * no `GET /api/v1/samantha/.../signals` endpoint. `detectSignals` is a pure, callable domain
 * function only; wiring it into an HTTP surface + storage is deferred to a later phase.
 */

export type SamanthaSignalType =
  | "CTR_DROP"
  | "CTR_IMPROVEMENT"
  | "CPL_SPIKE"
  | "CPL_IMPROVEMENT"
  | "FREQUENCY_RISE"
  | "CREATIVE_FATIGUE"
  | "SPEND_WITHOUT_RESULT"
  | "INSUFFICIENT_DATA";

export type SamanthaSignalSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SamanthaSignal {
  readonly type: SamanthaSignalType;
  readonly severity: SamanthaSignalSeverity;
  readonly metric?: string;
  readonly currentValue?: number;
  readonly baselineValue?: number;
  readonly deltaPct?: number;
  /** Ties to `dataSufficiency.score` (0-100, normalized to 0-1) — a signal detected from a MEDIUM-sufficiency window is honestly presented as less certain than one from HIGH. */
  readonly confidence: number;
  /** Indonesian, specific — mirrors `data-sufficiency.ts`'s reasoning string style/tone. */
  readonly reasoning: string;
}

export interface SignalDetectionInput {
  /** e.g. the account/campaign's real `"last_7_days"` snapshot. */
  readonly current: MetricSnapshotDto;
  /** e.g. the same account/campaign's real `"previous_7_days"` snapshot — same-length window immediately before `current`. */
  readonly previous: MetricSnapshotDto;
  /** `assessDataSufficiency` result FOR `current` — gates every detector below. */
  readonly dataSufficiency: DataSufficiencyResult;
  /** Real current ad-level/campaign-level frequency, if the caller has it — `undefined` skips `CREATIVE_FATIGUE` entirely (never fabricated). */
  readonly frequencyForFatigue?: number;
  /** `(current.ctr - previous.ctr) / previous.ctr`, or `undefined` — caller computes and passes; this function stays pure. */
  readonly ctrTrendForFatigue?: number;
}

/**
 * Relative-delta thresholds for the 4 comparative detectors — same order-of-magnitude "15% is a
 * real, meaningful move" philosophy `fatigue.ts`'s own `FATIGUED_CTR_TREND_THRESHOLD` (-15%)
 * establishes (this file's `CTR_DROP`/`CPL_SPIKE` reuse that exact -15%/+15% magnitude for
 * consistency, rather than inventing a different threshold philosophy for what is fundamentally the
 * same "CTR moved meaningfully" question). `FREQUENCY_RISE` uses a smaller 8% threshold — matching
 * `fatigue.ts`'s own `WARNING_CTR_TREND_THRESHOLD` (-8%) magnitude — because `frequency` is a slower-
 * moving, more granular metric where an 8% week-over-week rise is already a real, actionable signal.
 */
export const CTR_DROP_THRESHOLD = -0.15;
export const CTR_IMPROVEMENT_THRESHOLD = 0.15;
export const CPL_SPIKE_THRESHOLD = 0.15;
export const CPL_IMPROVEMENT_THRESHOLD = -0.15;
export const FREQUENCY_RISE_THRESHOLD = 0.08;

function confidenceFromScore(dataSufficiency: DataSufficiencyResult): number {
  return Math.round(dataSufficiency.score) / 100;
}

function relativeDelta(
  current: number | undefined,
  baseline: number | undefined,
): number | undefined {
  if (current === undefined || baseline === undefined || baseline === 0) {
    return undefined;
  }
  return (current - baseline) / baseline;
}

function detectCtrSignals(input: SignalDetectionInput, confidence: number): SamanthaSignal[] {
  const delta = relativeDelta(input.current.ctr, input.previous.ctr);
  if (delta === undefined) {
    return [];
  }
  if (delta <= CTR_DROP_THRESHOLD) {
    return [
      {
        type: "CTR_DROP",
        severity: delta <= CTR_DROP_THRESHOLD * 2 ? "HIGH" : "MEDIUM",
        metric: "ctr",
        currentValue: input.current.ctr,
        baselineValue: input.previous.ctr,
        deltaPct: delta,
        confidence,
        reasoning: `CTR turun ${String(Math.round(Math.abs(delta) * 100))}% dibanding periode sebelumnya — penurunan signifikan (ambang ${String(Math.round(Math.abs(CTR_DROP_THRESHOLD) * 100))}%).`,
      },
    ];
  }
  if (delta >= CTR_IMPROVEMENT_THRESHOLD) {
    return [
      {
        type: "CTR_IMPROVEMENT",
        severity: "INFO",
        metric: "ctr",
        currentValue: input.current.ctr,
        baselineValue: input.previous.ctr,
        deltaPct: delta,
        confidence,
        reasoning: `CTR naik ${String(Math.round(delta * 100))}% dibanding periode sebelumnya — peningkatan signifikan (ambang ${String(Math.round(CTR_IMPROVEMENT_THRESHOLD * 100))}%).`,
      },
    ];
  }
  return [];
}

function detectCplSignals(input: SignalDetectionInput, confidence: number): SamanthaSignal[] {
  const delta = relativeDelta(input.current.cpl, input.previous.cpl);
  if (delta === undefined) {
    return [];
  }
  if (delta >= CPL_SPIKE_THRESHOLD) {
    return [
      {
        type: "CPL_SPIKE",
        severity: delta >= CPL_SPIKE_THRESHOLD * 2 ? "HIGH" : "MEDIUM",
        metric: "cpl",
        currentValue: input.current.cpl,
        baselineValue: input.previous.cpl,
        deltaPct: delta,
        confidence,
        reasoning: `CPL naik ${String(Math.round(delta * 100))}% dibanding periode sebelumnya — biaya per lead memburuk (ambang ${String(Math.round(CPL_SPIKE_THRESHOLD * 100))}%).`,
      },
    ];
  }
  if (delta <= CPL_IMPROVEMENT_THRESHOLD) {
    return [
      {
        type: "CPL_IMPROVEMENT",
        severity: "INFO",
        metric: "cpl",
        currentValue: input.current.cpl,
        baselineValue: input.previous.cpl,
        deltaPct: delta,
        confidence,
        reasoning: `CPL turun ${String(Math.round(Math.abs(delta) * 100))}% dibanding periode sebelumnya — biaya per lead membaik (ambang ${String(Math.round(Math.abs(CPL_IMPROVEMENT_THRESHOLD) * 100))}%).`,
      },
    ];
  }
  return [];
}

function detectFrequencyRise(input: SignalDetectionInput, confidence: number): SamanthaSignal[] {
  const delta = relativeDelta(input.current.frequency, input.previous.frequency);
  if (delta === undefined || delta < FREQUENCY_RISE_THRESHOLD) {
    return [];
  }
  return [
    {
      type: "FREQUENCY_RISE",
      severity: delta >= FREQUENCY_RISE_THRESHOLD * 2 ? "MEDIUM" : "LOW",
      metric: "frequency",
      currentValue: input.current.frequency,
      baselineValue: input.previous.frequency,
      deltaPct: delta,
      confidence,
      reasoning: `Frequency naik ${String(Math.round(delta * 100))}% dibanding periode sebelumnya — audiens mulai melihat iklan berulang kali lebih sering (ambang ${String(Math.round(FREQUENCY_RISE_THRESHOLD * 100))}%).`,
    },
  ];
}

/**
 * `current.spend > 0 && current.leads === 0` — real spend with zero real leads. Gated at
 * `dataSufficiency.level` at least `LOW` (never `INSUFFICIENT`, already short-circuited earlier;
 * this extra check exists so a caller who somehow reaches this detector at exactly the boundary
 * still gets the intended gate documented explicitly): a day-1 campaign with a handful of
 * impressions and zero leads is normal noise, not yet a real signal — `LOW` already requires at
 * least `INSUFFICIENT_IMPRESSIONS_THRESHOLD` (1,000) impressions and 2 real days of data (see
 * `data-sufficiency.ts`), which is enough real exposure for "spend with zero result" to mean
 * something.
 */
function detectSpendWithoutResult(
  input: SignalDetectionInput,
  confidence: number,
): SamanthaSignal[] {
  const sufficientForThisSignal =
    input.dataSufficiency.level === "LOW" ||
    input.dataSufficiency.level === "MEDIUM" ||
    input.dataSufficiency.level === "HIGH";
  if (!sufficientForThisSignal || !(input.current.spend > 0 && input.current.leads === 0)) {
    return [];
  }
  return [
    {
      type: "SPEND_WITHOUT_RESULT",
      severity: "HIGH",
      metric: "leads",
      currentValue: input.current.leads,
      confidence,
      reasoning: `Spend Rp${String(Math.round(input.current.spend))} sudah keluar tapi belum menghasilkan satupun lead pada periode ini.`,
    },
  ];
}

function detectCreativeFatigue(input: SignalDetectionInput, confidence: number): SamanthaSignal[] {
  if (input.frequencyForFatigue === undefined) {
    return [];
  }
  const evaluation = evaluateFatigue({
    frequencyCurrent: input.frequencyForFatigue,
    ctrTrend: input.ctrTrendForFatigue,
  });
  if (evaluation.status === "NORMAL") {
    return [];
  }
  return [
    {
      type: "CREATIVE_FATIGUE",
      severity: evaluation.status === "FATIGUED" ? "HIGH" : "MEDIUM",
      metric: "frequency",
      currentValue: input.frequencyForFatigue,
      confidence,
      reasoning: evaluation.reasoning,
    },
  ];
}

export function detectSignals(input: SignalDetectionInput): readonly SamanthaSignal[] {
  if (input.dataSufficiency.level === "INSUFFICIENT") {
    return [
      {
        type: "INSUFFICIENT_DATA",
        severity: "INFO",
        confidence: confidenceFromScore(input.dataSufficiency),
        reasoning:
          input.dataSufficiency.reasons[0] ??
          "Data belum cukup untuk mendeteksi sinyal apapun secara bertanggung jawab.",
      },
    ];
  }

  const confidence = confidenceFromScore(input.dataSufficiency);

  return [
    ...detectCtrSignals(input, confidence),
    ...detectCplSignals(input, confidence),
    ...detectFrequencyRise(input, confidence),
    ...detectSpendWithoutResult(input, confidence),
    ...detectCreativeFatigue(input, confidence),
  ];
}
