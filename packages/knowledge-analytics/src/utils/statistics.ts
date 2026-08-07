import { InvalidSampleException } from "../errors/invalid-sample-exception.js";

/** Sum of `values`. Returns 0 for an empty array. */
export function calculateSum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Arithmetic mean of `values`. Throws for an empty array (an average of nothing is undefined). */
export function calculateAverage(values: readonly number[]): number {
  if (values.length === 0) {
    throw new InvalidSampleException("Cannot compute the average of an empty sample set");
  }
  return calculateSum(values) / values.length;
}

/** Minimum of `values`. Throws for an empty array. */
export function calculateMin(values: readonly number[]): number {
  if (values.length === 0) {
    throw new InvalidSampleException("Cannot compute the minimum of an empty sample set");
  }
  return Math.min(...values);
}

/** Maximum of `values`. Throws for an empty array. */
export function calculateMax(values: readonly number[]): number {
  if (values.length === 0) {
    throw new InvalidSampleException("Cannot compute the maximum of an empty sample set");
  }
  return Math.max(...values);
}

/**
 * Computes `numerator / denominator` as a 0-1 ratio. Returns exactly 0 when `denominator` is 0
 * (an empty-population rate is defined as 0 rather than `NaN`/`Infinity`, which keeps every
 * downstream report deterministic even before any samples have been recorded).
 */
export function calculateRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}
