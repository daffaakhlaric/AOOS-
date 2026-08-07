import type { ThresholdBand, WeightedSignal } from "../types/common.js";

/** Clamps `value` into `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalizes `value` (within `[min, max]`) onto the `[0, 100]` scale. `min === max` normalizes to
 * 100 when `value >= min`, else 0 — avoids a division by zero for degenerate ranges.
 */
export function normalizeToScore(value: number, min: number, max: number): number {
  if (max === min) return value >= min ? 100 : 0;
  const ratio = (value - min) / (max - min);
  return clamp(ratio * 100, 0, 100);
}

/**
 * Real weighted-average aggregation over already-normalized (0-100) sub-scores. Weights are
 * normalized internally so callers may pass any positive relative weights. Throws if the signal
 * list is empty or every weight is non-positive.
 */
export function weightedAverage(signals: readonly WeightedSignal[]): number {
  if (signals.length === 0) {
    throw new RangeError("weightedAverage: signals must not be empty");
  }
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight <= 0) {
    throw new RangeError("weightedAverage: total weight must be > 0");
  }
  const weightedSum = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
  return clamp(weightedSum / totalWeight, 0, 100);
}

/**
 * Evaluates `score` against a list of threshold bands (each a `{ label, min }` lower bound) and
 * returns the label of the highest band whose `min` the score satisfies. Bands need not be
 * pre-sorted. Throws if no band matches (i.e. no band has `min <= score`).
 */
export function evaluateThreshold(score: number, bands: readonly ThresholdBand[]): string {
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  const matched = sorted.find((band) => score >= band.min);
  if (!matched) {
    throw new RangeError(`evaluateThreshold: no band matches score ${score}`);
  }
  return matched.label;
}

/** Composite score: the weighted average of the given signals, rounded to 2 decimal places. */
export function computeCompositeScore(signals: readonly WeightedSignal[]): number {
  return Math.round(weightedAverage(signals) * 100) / 100;
}
