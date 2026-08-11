import { describe, expect, it } from "vitest";

import { BudgetAllocation } from "../../../../src/domain/value-objects/BudgetAllocation.js";
import { unwrap } from "../../../helpers/result.js";

describe("BudgetAllocation", () => {
  it("creates a valid non-negative integer amount", () => {
    expect(unwrap(BudgetAllocation.create(30_000_000)).toNumber()).toBe(30_000_000);
  });

  it("creates zero", () => {
    expect(unwrap(BudgetAllocation.create(0)).toNumber()).toBe(0);
  });

  it("rejects a negative amount", () => {
    expect(BudgetAllocation.create(-1).ok).toBe(false);
  });

  it("rejects a non-integer", () => {
    expect(BudgetAllocation.create(100.5).ok).toBe(false);
  });

  it("rejects NaN", () => {
    expect(BudgetAllocation.create(NaN).ok).toBe(false);
  });

  it("rejects Infinity", () => {
    expect(BudgetAllocation.create(Infinity).ok).toBe(false);
  });

  it("rejects a non-number", () => {
    expect(BudgetAllocation.create("100" as unknown as number).ok).toBe(false);
  });

  it("zero() returns a zero BudgetAllocation", () => {
    expect(BudgetAllocation.zero().toNumber()).toBe(0);
    expect(BudgetAllocation.zero().isZero()).toBe(true);
  });

  it("isZero is false for a positive amount", () => {
    expect(unwrap(BudgetAllocation.create(1)).isZero()).toBe(false);
  });

  it("add sums two amounts", () => {
    const a = unwrap(BudgetAllocation.create(100));
    const b = unwrap(BudgetAllocation.create(50));
    expect(a.add(b).toNumber()).toBe(150);
  });

  it("subtract floors at zero", () => {
    const a = unwrap(BudgetAllocation.create(50));
    const b = unwrap(BudgetAllocation.create(100));
    expect(a.subtract(b).toNumber()).toBe(0);
  });

  it("subtract computes a normal difference", () => {
    const a = unwrap(BudgetAllocation.create(100));
    const b = unwrap(BudgetAllocation.create(30));
    expect(a.subtract(b).toNumber()).toBe(70);
  });

  it("isGreaterThan compares amounts", () => {
    const a = unwrap(BudgetAllocation.create(100));
    const b = unwrap(BudgetAllocation.create(50));
    expect(a.isGreaterThan(b)).toBe(true);
    expect(b.isGreaterThan(a)).toBe(false);
  });

  it("isGreaterThanOrEqual compares amounts", () => {
    const a = unwrap(BudgetAllocation.create(100));
    const b = unwrap(BudgetAllocation.create(100));
    expect(a.isGreaterThanOrEqual(b)).toBe(true);
  });

  it("isLessThan compares amounts", () => {
    const a = unwrap(BudgetAllocation.create(50));
    const b = unwrap(BudgetAllocation.create(100));
    expect(a.isLessThan(b)).toBe(true);
    expect(b.isLessThan(a)).toBe(false);
  });

  it("equals compares amounts", () => {
    const a = unwrap(BudgetAllocation.create(100));
    const b = unwrap(BudgetAllocation.create(100));
    const c = unwrap(BudgetAllocation.create(200));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
