import { describe, expect, it } from "vitest";

import { KnowledgeMetricCalculator } from "../../src/metrics/knowledge-metric-calculator.js";
import { ONE_TO_HUNDRED, ONE_TO_HUNDRED_STATS } from "../helpers/fixtures.js";

describe("KnowledgeMetricCalculator", () => {
  const calculator = new KnowledgeMetricCalculator();

  it("average delegates to calculateAverage", () => {
    expect(calculator.average(ONE_TO_HUNDRED)).toBe(ONE_TO_HUNDRED_STATS.average);
  });

  it("sum delegates to calculateSum", () => {
    expect(calculator.sum(ONE_TO_HUNDRED)).toBe(ONE_TO_HUNDRED_STATS.sum);
  });

  it("min delegates to calculateMin", () => {
    expect(calculator.min(ONE_TO_HUNDRED)).toBe(ONE_TO_HUNDRED_STATS.min);
  });

  it("max delegates to calculateMax", () => {
    expect(calculator.max(ONE_TO_HUNDRED)).toBe(ONE_TO_HUNDRED_STATS.max);
  });

  it("rate delegates to calculateRate", () => {
    expect(calculator.rate(80, 100)).toBe(0.8);
  });

  it("percentile delegates to calculatePercentile", () => {
    expect(calculator.percentile(ONE_TO_HUNDRED, 95)).toBeCloseTo(ONE_TO_HUNDRED_STATS.p95, 10);
  });

  describe("percentiles", () => {
    it("computes every threshold, keyed by threshold", () => {
      const result = calculator.percentiles(ONE_TO_HUNDRED, [95, 99]);
      expect(result[95]).toBeCloseTo(ONE_TO_HUNDRED_STATS.p95, 10);
      expect(result[99]).toBeCloseTo(ONE_TO_HUNDRED_STATS.p99, 10);
    });

    it("returns an empty object for an empty threshold list", () => {
      expect(calculator.percentiles(ONE_TO_HUNDRED, [])).toEqual({});
    });
  });
});
