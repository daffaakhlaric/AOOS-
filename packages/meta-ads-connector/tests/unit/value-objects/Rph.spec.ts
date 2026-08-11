import { describe, expect, it } from "vitest";

import { Rph } from "../../../src/domain/value-objects/Rph.js";

describe("Rph", () => {
  it("calculates spend / count", () => {
    expect(Rph.calculate(10000, 4).value).toBe(2500);
  });

  it("is undefined (null) when count is zero — division-by-zero safe", () => {
    const rph = Rph.calculate(10000, 0);
    expect(rph.value).toBeNull();
    expect(rph.isDefined()).toBe(false);
  });

  it("is undefined when count is negative", () => {
    expect(Rph.calculate(10000, -1).value).toBeNull();
  });

  it("is undefined when spend is not finite", () => {
    expect(Rph.calculate(Infinity, 4).value).toBeNull();
  });

  it("is undefined when count is not finite", () => {
    expect(Rph.calculate(10000, Infinity).value).toBeNull();
  });

  it("is undefined when a finite spend divided by a finite count overflows to Infinity", () => {
    // Both operands are individually finite (pass the isFinite guards), but the division itself
    // overflows JS's float64 range — the post-division `Number.isFinite(result)` guard catches
    // this case that the pre-division guards on spendAmount/count cannot.
    expect(Rph.calculate(Number.MAX_VALUE, Number.MIN_VALUE).value).toBeNull();
  });

  it("undefined_() returns a null-value Rph", () => {
    expect(Rph.undefined_().value).toBeNull();
  });

  it("isAtMost is true at and below the threshold", () => {
    expect(Rph.calculate(5500, 1).isAtMost(5500)).toBe(true);
    expect(Rph.calculate(5501, 1).isAtMost(5500)).toBe(false);
  });

  it("isAtMost is false when undefined", () => {
    expect(Rph.undefined_().isAtMost(5500)).toBe(false);
  });

  it("isAbove is true strictly above the threshold", () => {
    expect(Rph.calculate(22001, 1).isAbove(22000)).toBe(true);
    expect(Rph.calculate(22000, 1).isAbove(22000)).toBe(false);
  });

  it("isAbove is false when undefined", () => {
    expect(Rph.undefined_().isAbove(22000)).toBe(false);
  });

  it("isWithin is inclusive on both bounds", () => {
    expect(Rph.calculate(9000, 1).isWithin(9000, 22000)).toBe(true);
    expect(Rph.calculate(22000, 1).isWithin(9000, 22000)).toBe(true);
    expect(Rph.calculate(8999, 1).isWithin(9000, 22000)).toBe(false);
    expect(Rph.calculate(22001, 1).isWithin(9000, 22000)).toBe(false);
  });

  it("isWithin is false when undefined", () => {
    expect(Rph.undefined_().isWithin(9000, 22000)).toBe(false);
  });

  it("equals compares underlying values, including two undefined Rphs", () => {
    expect(Rph.calculate(100, 2).equals(Rph.calculate(200, 4))).toBe(true);
    expect(Rph.undefined_().equals(Rph.undefined_())).toBe(true);
    expect(Rph.calculate(100, 2).equals(Rph.undefined_())).toBe(false);
  });
});
