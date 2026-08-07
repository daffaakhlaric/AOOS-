import { describe, expect, it } from "vitest";

import { InvalidSampleException } from "../../src/errors/invalid-sample-exception.js";
import { KnowledgeMetricCalculator } from "../../src/metrics/knowledge-metric-calculator.js";

describe("KnowledgeMetricCalculator additional coverage", () => {
  const calculator = new KnowledgeMetricCalculator();

  it("average throws for an empty array (delegated)", () => {
    expect(() => calculator.average([])).toThrow(InvalidSampleException);
  });

  it("min/max throw for an empty array (delegated)", () => {
    expect(() => calculator.min([])).toThrow(InvalidSampleException);
    expect(() => calculator.max([])).toThrow(InvalidSampleException);
  });

  it("percentile throws for an empty array (delegated)", () => {
    expect(() => calculator.percentile([], 50)).toThrow(InvalidSampleException);
  });

  it("rate returns 0 for a 0/0 case", () => {
    expect(calculator.rate(0, 0)).toBe(0);
  });

  it("percentiles computes multiple distinct thresholds independently", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = calculator.percentiles(values, [0, 50, 100]);
    expect(result[0]).toBe(1);
    expect(result[100]).toBe(10);
  });

  it("handles negative values in min/max/average", () => {
    expect(calculator.min([-5, -1, -10])).toBe(-10);
    expect(calculator.max([-5, -1, -10])).toBe(-1);
    expect(calculator.average([-5, 5])).toBe(0);
  });

  it("sum returns 0 for an empty array", () => {
    expect(calculator.sum([])).toBe(0);
  });
});
