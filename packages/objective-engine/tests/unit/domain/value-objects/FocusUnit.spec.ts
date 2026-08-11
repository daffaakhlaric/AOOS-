import { describe, expect, it } from "vitest";

import { FOCUS_UNITS, FocusUnit } from "../../../../src/domain/value-objects/FocusUnit.js";
import { unwrap } from "../../../helpers/result.js";

describe("FocusUnit", () => {
  it("creates every known focus unit", () => {
    for (const name of FOCUS_UNITS) {
      expect(unwrap(FocusUnit.create(name)).toString()).toBe(name);
    }
  });

  it("rejects an unknown unit name", () => {
    expect(FocusUnit.create("Tesla Model 3").ok).toBe(false);
  });

  it("rejects a non-string", () => {
    expect(FocusUnit.create(123 as unknown as string).ok).toBe(false);
  });

  it("equals compares by name", () => {
    const a = unwrap(FocusUnit.create("Xpander"));
    const b = unwrap(FocusUnit.create("Xpander"));
    const c = unwrap(FocusUnit.create("Brio"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
