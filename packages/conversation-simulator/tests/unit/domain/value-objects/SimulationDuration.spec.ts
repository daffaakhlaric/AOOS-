import { describe, expect, it } from "vitest";

import { SimulationDuration } from "../../../../src/domain/value-objects/SimulationDuration.js";

describe("SimulationDuration", () => {
  it("zero() starts at 0ms", () => {
    expect(SimulationDuration.zero().toMillis()).toBe(0);
  });

  it("of() accepts a non-negative finite number", () => {
    expect(SimulationDuration.of(1500).toMillis()).toBe(1500);
  });

  it("of() rejects negative numbers", () => {
    expect(() => SimulationDuration.of(-1)).toThrow(RangeError);
  });

  it("of() rejects non-finite numbers", () => {
    expect(() => SimulationDuration.of(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("between() computes elapsed time, floored at 0", () => {
    expect(SimulationDuration.between(1000, 2500).toMillis()).toBe(1500);
    expect(SimulationDuration.between(2000, 1000).toMillis()).toBe(0);
  });

  it("exceeds() compares against a budget", () => {
    expect(SimulationDuration.of(31_000).exceeds(30_000)).toBe(true);
    expect(SimulationDuration.of(29_000).exceeds(30_000)).toBe(false);
  });
});
