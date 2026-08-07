import { describe, expect, it } from "vitest";

import { computeExponentialBackoffDelay } from "../../src/utils/backoff.js";

describe("computeExponentialBackoffDelay", () => {
  it("computes baseDelayMs for attempt 0 (multiplier^0 = 1)", () => {
    expect(computeExponentialBackoffDelay(0, { baseDelayMs: 1000 })).toBe(1000);
  });

  it("doubles by default per attempt", () => {
    expect(computeExponentialBackoffDelay(1, { baseDelayMs: 1000 })).toBe(2000);
    expect(computeExponentialBackoffDelay(2, { baseDelayMs: 1000 })).toBe(4000);
    expect(computeExponentialBackoffDelay(3, { baseDelayMs: 1000 })).toBe(8000);
  });

  it("uses a custom multiplier", () => {
    expect(computeExponentialBackoffDelay(2, { baseDelayMs: 100, multiplier: 3 })).toBe(900);
  });

  it("caps at maxDelayMs", () => {
    expect(computeExponentialBackoffDelay(10, { baseDelayMs: 1000, maxDelayMs: 5000 })).toBe(5000);
  });

  it("does not cap when under maxDelayMs", () => {
    expect(computeExponentialBackoffDelay(1, { baseDelayMs: 1000, maxDelayMs: 5000 })).toBe(2000);
  });

  it("applies a supplied jitter function", () => {
    const delay = computeExponentialBackoffDelay(1, {
      baseDelayMs: 1000,
      jitter: (d) => d + 7,
    });
    expect(delay).toBe(2007);
  });

  it("applies jitter after capping", () => {
    const delay = computeExponentialBackoffDelay(10, {
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      jitter: (d) => d / 2,
    });
    expect(delay).toBe(2500);
  });

  it("handles baseDelayMs of 0", () => {
    expect(computeExponentialBackoffDelay(5, { baseDelayMs: 0 })).toBe(0);
  });

  it("throws on negative attempt", () => {
    expect(() => computeExponentialBackoffDelay(-1, { baseDelayMs: 1 })).toThrow(RangeError);
  });

  it("throws on non-integer attempt", () => {
    expect(() => computeExponentialBackoffDelay(1.5, { baseDelayMs: 1 })).toThrow(RangeError);
  });

  it("throws on negative baseDelayMs", () => {
    expect(() => computeExponentialBackoffDelay(0, { baseDelayMs: -1 })).toThrow(RangeError);
  });

  it("throws on multiplier below 1", () => {
    expect(() => computeExponentialBackoffDelay(0, { baseDelayMs: 1, multiplier: 0.5 })).toThrow(
      RangeError,
    );
  });

  it("allows multiplier of exactly 1 (constant delay)", () => {
    expect(computeExponentialBackoffDelay(5, { baseDelayMs: 100, multiplier: 1 })).toBe(100);
  });

  describe("parameterized delay table (base=50, multiplier=2)", () => {
    const cases: Array<[number, number]> = [
      [0, 50],
      [1, 100],
      [2, 200],
      [3, 400],
      [4, 800],
      [5, 1600],
      [6, 3200],
    ];
    it.each(cases)("attempt %i -> %ims", (attempt, expected) => {
      expect(computeExponentialBackoffDelay(attempt, { baseDelayMs: 50, multiplier: 2 })).toBe(
        expected,
      );
    });
  });

  describe("parameterized delay table with multiplier=3", () => {
    const cases: Array<[number, number]> = [
      [0, 10],
      [1, 30],
      [2, 90],
      [3, 270],
    ];
    it.each(cases)("attempt %i -> %ims", (attempt, expected) => {
      expect(computeExponentialBackoffDelay(attempt, { baseDelayMs: 10, multiplier: 3 })).toBe(
        expected,
      );
    });
  });
});
