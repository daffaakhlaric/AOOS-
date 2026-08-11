import { describe, expect, it } from "vitest";

import { UnitPrice } from "../../../src/domain/value-objects/UnitPrice.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("UnitPrice", () => {
  it("creates a non-negative whole-rupiah amount", () => {
    const price = unwrap(UnitPrice.create(195_000_000));
    expect(price.toNumber()).toBe(195_000_000);
  });

  it("accepts zero", () => {
    const price = unwrap(UnitPrice.create(0));
    expect(price.toNumber()).toBe(0);
  });

  it("rejects a negative amount", () => {
    const error = unwrapErr(UnitPrice.create(-1));
    expect(error.message).toContain("not be negative");
  });

  it("rejects a non-finite amount", () => {
    const error = unwrapErr(UnitPrice.create(Number.POSITIVE_INFINITY));
    expect(error.message).toContain("finite");
  });

  it("rejects a non-numeric value at the type boundary", () => {
    const error = unwrapErr(UnitPrice.create("195000000" as unknown as number));
    expect(error.message).toContain("finite");
  });

  it("rejects a fractional rupiah amount", () => {
    const error = unwrapErr(UnitPrice.create(100.5));
    expect(error.message).toContain("whole rupiah");
  });

  it("unsafe() rounds and clamps to zero", () => {
    expect(UnitPrice.unsafe(-5).toNumber()).toBe(0);
    expect(UnitPrice.unsafe(10.6).toNumber()).toBe(11);
  });

  it("add() sums two prices", () => {
    const a = unwrap(UnitPrice.create(100));
    const b = unwrap(UnitPrice.create(50));
    expect(a.add(b).toNumber()).toBe(150);
  });

  it("subtract() clamps at zero", () => {
    const a = unwrap(UnitPrice.create(50));
    const b = unwrap(UnitPrice.create(100));
    expect(a.subtract(b).toNumber()).toBe(0);
  });

  it("subtract() computes a positive difference normally", () => {
    const a = unwrap(UnitPrice.create(150));
    const b = unwrap(UnitPrice.create(50));
    expect(a.subtract(b).toNumber()).toBe(100);
  });

  it("isGreaterThan() compares amounts", () => {
    const a = unwrap(UnitPrice.create(200));
    const b = unwrap(UnitPrice.create(100));
    expect(a.isGreaterThan(b)).toBe(true);
    expect(b.isGreaterThan(a)).toBe(false);
  });

  it("isLessThanOrEqual() compares amounts", () => {
    const a = unwrap(UnitPrice.create(100));
    const b = unwrap(UnitPrice.create(100));
    const c = unwrap(UnitPrice.create(200));
    expect(a.isLessThanOrEqual(b)).toBe(true);
    expect(a.isLessThanOrEqual(c)).toBe(true);
    expect(c.isLessThanOrEqual(a)).toBe(false);
  });

  it("equals() compares by value", () => {
    const a = unwrap(UnitPrice.create(100));
    const b = unwrap(UnitPrice.create(100));
    expect(a.equals(b)).toBe(true);
  });
});
