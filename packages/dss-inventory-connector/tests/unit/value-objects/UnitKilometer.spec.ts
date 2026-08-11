import { describe, expect, it } from "vitest";

import {
  MAX_UNIT_KILOMETER,
  UnitKilometer,
} from "../../../src/domain/value-objects/UnitKilometer.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("UnitKilometer", () => {
  it("accepts zero", () => {
    expect(unwrap(UnitKilometer.create(0)).toNumber()).toBe(0);
  });

  it("accepts the maximum", () => {
    expect(unwrap(UnitKilometer.create(MAX_UNIT_KILOMETER)).toNumber()).toBe(MAX_UNIT_KILOMETER);
  });

  it("rejects a negative reading", () => {
    const error = unwrapErr(UnitKilometer.create(-1));
    expect(error.message).toContain("between");
  });

  it("rejects a reading beyond the maximum", () => {
    const error = unwrapErr(UnitKilometer.create(MAX_UNIT_KILOMETER + 1));
    expect(error.message).toContain("between");
  });

  it("rejects a non-integer", () => {
    const error = unwrapErr(UnitKilometer.create(100.5));
    expect(error.message).toContain("integer");
  });

  it("equals() compares by value", () => {
    const a = unwrap(UnitKilometer.create(1000));
    const b = unwrap(UnitKilometer.create(1000));
    expect(a.equals(b)).toBe(true);
  });
});
