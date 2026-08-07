import { calculatePercentile as percentileOf } from "../utils/percentile.js";
import {
  calculateAverage,
  calculateMax,
  calculateMin,
  calculateRate,
  calculateSum,
} from "../utils/statistics.js";

/**
 * Shared real-computation engine used by every analytics service instead of each one
 * reimplementing rate/average/percentile math. Stateless — every method is a pure function over
 * its arguments.
 */
export class KnowledgeMetricCalculator {
  average(values: readonly number[]): number {
    return calculateAverage(values);
  }

  sum(values: readonly number[]): number {
    return calculateSum(values);
  }

  min(values: readonly number[]): number {
    return calculateMin(values);
  }

  max(values: readonly number[]): number {
    return calculateMax(values);
  }

  rate(numerator: number, denominator: number): number {
    return calculateRate(numerator, denominator);
  }

  percentile(values: readonly number[], p: number): number {
    return percentileOf(values, p);
  }

  /** Computes every percentile in `thresholds`, keyed by threshold (e.g. `{ 95: 120, 99: 210 }`). */
  percentiles(
    values: readonly number[],
    thresholds: readonly number[],
  ): Readonly<Record<number, number>> {
    const result: Record<number, number> = {};
    for (const threshold of thresholds) {
      result[threshold] = percentileOf(values, threshold);
    }
    return result;
  }
}
