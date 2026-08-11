import { describe, expect, it } from "vitest";

import { TurnCount } from "../../../../src/domain/value-objects/TurnCount.js";

describe("TurnCount", () => {
  it("zero() starts at 0", () => {
    expect(TurnCount.zero().toNumber()).toBe(0);
  });

  it("increment() returns a new instance one higher, without mutating the original", () => {
    const start = TurnCount.zero();
    const next = start.increment();
    expect(start.toNumber()).toBe(0);
    expect(next.toNumber()).toBe(1);
  });

  it("of() accepts a non-negative integer", () => {
    expect(TurnCount.of(5).toNumber()).toBe(5);
  });

  it("of() rejects negative numbers", () => {
    expect(() => TurnCount.of(-1)).toThrow(RangeError);
  });

  it("of() rejects non-integers", () => {
    expect(() => TurnCount.of(1.5)).toThrow(RangeError);
  });

  it("isAtLeast() compares against a threshold", () => {
    expect(TurnCount.of(5).isAtLeast(5)).toBe(true);
    expect(TurnCount.of(4).isAtLeast(5)).toBe(false);
  });

  it("equals() compares by value", () => {
    expect(TurnCount.of(3).equals(TurnCount.of(3))).toBe(true);
    expect(TurnCount.of(3).equals(TurnCount.of(4))).toBe(false);
  });
});
