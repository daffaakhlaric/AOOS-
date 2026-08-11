import { describe, expect, it } from "vitest";

import { DmsUnitId } from "../../../src/domain/value-objects/DmsUnitId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("DmsUnitId", () => {
  it("creates from a non-empty string", () => {
    const id = unwrap(DmsUnitId.create("DMS-001"));
    expect(id.toString()).toBe("DMS-001");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(DmsUnitId.create(""));
    expect(error.message).toContain("non-empty string");
  });

  it("equals() compares by value", () => {
    const a = unwrap(DmsUnitId.create("x"));
    const b = unwrap(DmsUnitId.create("x"));
    const c = unwrap(DmsUnitId.create("y"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
