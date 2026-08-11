import { describe, expect, it } from "vitest";

import { UnitModel } from "../../../src/domain/value-objects/UnitModel.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("UnitModel", () => {
  it("creates and trims a non-empty string", () => {
    const model = unwrap(UnitModel.create("  Xpander Cross  "));
    expect(model.toString()).toBe("Xpander Cross");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(UnitModel.create(""));
    expect(error.message).toContain("non-empty string");
  });

  it("equals() compares by value", () => {
    const a = unwrap(UnitModel.create("Rush"));
    const b = unwrap(UnitModel.create("Rush"));
    const c = unwrap(UnitModel.create("Avanza"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
