import { describe, expect, it } from "vitest";

import { UnitBrand } from "../../../src/domain/value-objects/UnitBrand.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("UnitBrand", () => {
  it("creates and trims a non-empty string", () => {
    const brand = unwrap(UnitBrand.create("  Mitsubishi  "));
    expect(brand.toString()).toBe("Mitsubishi");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(UnitBrand.create(""));
    expect(error.message).toContain("non-empty string");
  });

  it("equals() compares by value", () => {
    const a = unwrap(UnitBrand.create("Toyota"));
    const b = unwrap(UnitBrand.create("Toyota"));
    expect(a.equals(b)).toBe(true);
  });
});
