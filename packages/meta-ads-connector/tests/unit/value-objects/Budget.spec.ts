import { describe, expect, it } from "vitest";

import { Budget } from "../../../src/domain/value-objects/Budget.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("Budget", () => {
  it("creates a valid non-negative Budget", () => {
    expect(unwrap(Budget.create(50000)).toNumber()).toBe(50000);
  });

  it("rejects a negative amount", () => {
    expect(Budget.create(-1).ok).toBe(false);
  });

  it("rejects a non-finite amount", () => {
    expect(Budget.create(Infinity).ok).toBe(false);
  });

  it("rejects a non-number", () => {
    expect(Budget.create("100" as unknown as number).ok).toBe(false);
  });

  it("scaleBy applies a +20% SCALE factor rounded to the nearest whole IDR unit", () => {
    const budget = unwrap(Budget.create(100_000));
    expect(unwrap(budget.scaleBy(1.2)).toNumber()).toBe(120_000);
  });

  it("scaleBy rounds fractional results", () => {
    const budget = unwrap(Budget.create(333));
    expect(unwrap(budget.scaleBy(1.2)).toNumber()).toBe(Math.round(333 * 1.2));
  });

  it("scaleBy rejects a zero factor", () => {
    const budget = unwrap(Budget.create(100));
    expect(unwrapErr(budget.scaleBy(0)).message).toMatch(/positive/);
  });

  it("scaleBy rejects a negative factor", () => {
    const budget = unwrap(Budget.create(100));
    expect(budget.scaleBy(-1).ok).toBe(false);
  });

  it("scaleBy rejects a non-finite factor", () => {
    const budget = unwrap(Budget.create(100));
    expect(budget.scaleBy(Infinity).ok).toBe(false);
  });

  it("equals compares amounts", () => {
    const a = unwrap(Budget.create(100));
    const b = unwrap(Budget.create(100));
    const c = unwrap(Budget.create(200));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
