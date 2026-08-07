import { describe, expect, it } from "vitest";

import { InvalidSampleException } from "../../src/errors/invalid-sample-exception.js";
import { calculatePercentile } from "../../src/utils/percentile.js";
import {
  ONE_TO_HUNDRED,
  ONE_TO_HUNDRED_STATS,
  SMALL_LATENCY_SAMPLE,
  SMALL_LATENCY_STATS,
} from "../helpers/fixtures.js";

describe("calculatePercentile", () => {
  it("computes P50 exactly for 1..100", () => {
    expect(calculatePercentile(ONE_TO_HUNDRED, 50)).toBeCloseTo(ONE_TO_HUNDRED_STATS.p50, 10);
  });

  it("computes P95 exactly for 1..100", () => {
    expect(calculatePercentile(ONE_TO_HUNDRED, 95)).toBeCloseTo(ONE_TO_HUNDRED_STATS.p95, 10);
  });

  it("computes P99 exactly for 1..100", () => {
    expect(calculatePercentile(ONE_TO_HUNDRED, 99)).toBeCloseTo(ONE_TO_HUNDRED_STATS.p99, 10);
  });

  it("computes P95 exactly for a small 5-item sample", () => {
    expect(calculatePercentile(SMALL_LATENCY_SAMPLE, 95)).toBeCloseTo(SMALL_LATENCY_STATS.p95, 10);
  });

  it("computes P99 exactly for a small 5-item sample", () => {
    expect(calculatePercentile(SMALL_LATENCY_SAMPLE, 99)).toBeCloseTo(SMALL_LATENCY_STATS.p99, 10);
  });

  it("returns the sole value for a single-element array regardless of p", () => {
    expect(calculatePercentile([42], 0)).toBe(42);
    expect(calculatePercentile([42], 50)).toBe(42);
    expect(calculatePercentile([42], 100)).toBe(42);
  });

  it("P0 returns the minimum", () => {
    expect(calculatePercentile(ONE_TO_HUNDRED, 0)).toBe(1);
  });

  it("P100 returns the maximum", () => {
    expect(calculatePercentile(ONE_TO_HUNDRED, 100)).toBe(100);
  });

  it("does not mutate the input array", () => {
    const input = [5, 3, 1, 4, 2];
    const copy = [...input];
    calculatePercentile(input, 50);
    expect(input).toEqual(copy);
  });

  it("sorts unsorted input before computing", () => {
    const sorted = [1, 2, 3, 4, 5];
    const shuffled = [5, 1, 4, 2, 3];
    expect(calculatePercentile(shuffled, 50)).toBe(calculatePercentile(sorted, 50));
  });

  it("throws InvalidSampleException for an empty array", () => {
    expect(() => calculatePercentile([], 50)).toThrow(InvalidSampleException);
  });

  it("throws InvalidSampleException for p < 0", () => {
    expect(() => calculatePercentile([1, 2, 3], -1)).toThrow(InvalidSampleException);
  });

  it("throws InvalidSampleException for p > 100", () => {
    expect(() => calculatePercentile([1, 2, 3], 101)).toThrow(InvalidSampleException);
  });

  it("handles a two-element array via interpolation", () => {
    // index = 0.5 * 1 = 0.5 -> 10 + 0.5*(20-10) = 15
    expect(calculatePercentile([10, 20], 50)).toBe(15);
  });

  it("handles duplicate values correctly", () => {
    expect(calculatePercentile([5, 5, 5, 5], 50)).toBe(5);
  });
});
