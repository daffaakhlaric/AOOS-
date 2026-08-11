import { describe, expect, it } from "vitest";

import { UnitId } from "../../../src/domain/value-objects/UnitId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("UnitId", () => {
  it("creates from a non-empty string", () => {
    const id = unwrap(UnitId.create("unit-1"));
    expect(id.toString()).toBe("unit-1");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(UnitId.create(""));
    expect(error.message).toContain("non-empty string");
  });

  it("rejects a whitespace-only string", () => {
    const error = unwrapErr(UnitId.create("   "));
    expect(error.message).toContain("non-empty string");
  });

  it("generate() produces a fresh id each time", () => {
    const a = UnitId.generate();
    const b = UnitId.generate();
    expect(a.equals(b)).toBe(false);
  });

  it("equals() compares by value", () => {
    const a = unwrap(UnitId.create("same"));
    const b = unwrap(UnitId.create("same"));
    expect(a.equals(b)).toBe(true);
  });
});
