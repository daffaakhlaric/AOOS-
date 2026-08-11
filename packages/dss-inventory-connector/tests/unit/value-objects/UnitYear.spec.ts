import { describe, expect, it } from "vitest";

import { MIN_UNIT_YEAR, UnitYear } from "../../../src/domain/value-objects/UnitYear.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("UnitYear", () => {
  it("accepts the minimum year", () => {
    const year = unwrap(UnitYear.create(MIN_UNIT_YEAR));
    expect(year.toNumber()).toBe(MIN_UNIT_YEAR);
  });

  it("accepts the current year", () => {
    const currentYear = new Date().getFullYear();
    const year = unwrap(UnitYear.create(currentYear));
    expect(year.toNumber()).toBe(currentYear);
  });

  it("rejects a year below the minimum", () => {
    const error = unwrapErr(UnitYear.create(MIN_UNIT_YEAR - 1));
    expect(error.message).toContain("between");
  });

  it("rejects a year beyond the current year", () => {
    const error = unwrapErr(UnitYear.create(new Date().getFullYear() + 1));
    expect(error.message).toContain("between");
  });

  it("rejects a non-integer", () => {
    const error = unwrapErr(UnitYear.create(2019.5));
    expect(error.message).toContain("integer");
  });

  it("equals() compares by value", () => {
    const a = unwrap(UnitYear.create(2020));
    const b = unwrap(UnitYear.create(2020));
    expect(a.equals(b)).toBe(true);
  });
});
