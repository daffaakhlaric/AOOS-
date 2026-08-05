import { describe, expect, it } from "vitest";

import { assertNever, clamp, identity, isDefined, noop } from "../src/helpers.js";

describe("helpers", () => {
  it("noop does nothing and returns undefined", () => {
    expect(noop()).toBeUndefined();
  });

  it("identity returns its argument unchanged", () => {
    expect(identity(42)).toBe(42);
  });

  it("isDefined narrows out null and undefined", () => {
    expect(isDefined(0)).toBe(true);
    expect(isDefined(null)).toBe(false);
    expect(isDefined(undefined)).toBe(false);
  });

  it("assertNever throws with the offending value serialized", () => {
    expect(() => assertNever("unexpected" as never)).toThrow(/unexpected/);
  });

  it("clamp bounds a value within [min, max]", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
