import { describe, expect, it } from "vitest";

import { Spend } from "../../../src/domain/value-objects/Spend.js";
import { unwrap } from "../../helpers/result.js";

describe("Spend", () => {
  it("creates a valid non-negative Spend", () => {
    expect(unwrap(Spend.create(1000)).toNumber()).toBe(1000);
  });

  it("creates a zero Spend", () => {
    expect(unwrap(Spend.create(0)).toNumber()).toBe(0);
  });

  it("rejects a negative amount", () => {
    expect(Spend.create(-1).ok).toBe(false);
  });

  it("rejects NaN", () => {
    expect(Spend.create(NaN).ok).toBe(false);
  });

  it("rejects Infinity", () => {
    expect(Spend.create(Infinity).ok).toBe(false);
  });

  it("rejects a non-number", () => {
    expect(Spend.create("100" as unknown as number).ok).toBe(false);
  });

  it("zero() returns a zero Spend", () => {
    expect(Spend.zero().toNumber()).toBe(0);
    expect(Spend.zero().isZero()).toBe(true);
  });

  it("isZero is false for a positive amount", () => {
    expect(unwrap(Spend.create(1)).isZero()).toBe(false);
  });

  it("add sums two Spends", () => {
    const a = unwrap(Spend.create(100));
    const b = unwrap(Spend.create(50));
    expect(a.add(b).toNumber()).toBe(150);
  });

  it("equals compares amounts", () => {
    const a = unwrap(Spend.create(100));
    const b = unwrap(Spend.create(100));
    const c = unwrap(Spend.create(200));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
