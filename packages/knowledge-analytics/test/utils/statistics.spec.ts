import { describe, expect, it } from "vitest";

import { InvalidSampleException } from "../../src/errors/invalid-sample-exception.js";
import {
  calculateAverage,
  calculateMax,
  calculateMin,
  calculateRate,
  calculateSum,
} from "../../src/utils/statistics.js";
import {
  ONE_TO_HUNDRED,
  ONE_TO_HUNDRED_STATS,
  SMALL_LATENCY_SAMPLE,
  SMALL_LATENCY_STATS,
} from "../helpers/fixtures.js";

describe("calculateSum", () => {
  it("sums 1..100 to 5050", () => {
    expect(calculateSum(ONE_TO_HUNDRED)).toBe(ONE_TO_HUNDRED_STATS.sum);
  });

  it("sums a small sample exactly", () => {
    expect(calculateSum(SMALL_LATENCY_SAMPLE)).toBe(SMALL_LATENCY_STATS.sum);
  });

  it("returns 0 for an empty array", () => {
    expect(calculateSum([])).toBe(0);
  });

  it("handles negative numbers", () => {
    expect(calculateSum([-5, 5, 10])).toBe(10);
  });
});

describe("calculateAverage", () => {
  it("computes the average of 1..100 exactly", () => {
    expect(calculateAverage(ONE_TO_HUNDRED)).toBe(ONE_TO_HUNDRED_STATS.average);
  });

  it("computes the average of a small sample exactly", () => {
    expect(calculateAverage(SMALL_LATENCY_SAMPLE)).toBe(SMALL_LATENCY_STATS.average);
  });

  it("returns the value itself for a single-element array", () => {
    expect(calculateAverage([42])).toBe(42);
  });

  it("throws InvalidSampleException for an empty array", () => {
    expect(() => calculateAverage([])).toThrow(InvalidSampleException);
  });
});

describe("calculateMin", () => {
  it("returns 1 for 1..100", () => {
    expect(calculateMin(ONE_TO_HUNDRED)).toBe(ONE_TO_HUNDRED_STATS.min);
  });

  it("returns the smallest of a small sample", () => {
    expect(calculateMin(SMALL_LATENCY_SAMPLE)).toBe(SMALL_LATENCY_STATS.min);
  });

  it("throws InvalidSampleException for an empty array", () => {
    expect(() => calculateMin([])).toThrow(InvalidSampleException);
  });
});

describe("calculateMax", () => {
  it("returns 100 for 1..100", () => {
    expect(calculateMax(ONE_TO_HUNDRED)).toBe(ONE_TO_HUNDRED_STATS.max);
  });

  it("returns the largest of a small sample", () => {
    expect(calculateMax(SMALL_LATENCY_SAMPLE)).toBe(SMALL_LATENCY_STATS.max);
  });

  it("throws InvalidSampleException for an empty array", () => {
    expect(() => calculateMax([])).toThrow(InvalidSampleException);
  });
});

describe("calculateRate", () => {
  it("computes an exact ratio", () => {
    expect(calculateRate(80, 100)).toBe(0.8);
  });

  it("returns 0 when the denominator is 0, regardless of numerator", () => {
    expect(calculateRate(0, 0)).toBe(0);
    expect(calculateRate(5, 0)).toBe(0);
  });

  it("returns 1 when numerator equals denominator", () => {
    expect(calculateRate(42, 42)).toBe(1);
  });

  it("returns 0 when numerator is 0 and denominator is positive", () => {
    expect(calculateRate(0, 10)).toBe(0);
  });
});
