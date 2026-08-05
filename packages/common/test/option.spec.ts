import { describe, expect, it } from "vitest";

import { fromNullable, getOrElse, isNone, isSome, mapOption, none, some } from "../src/option.js";

describe("Option", () => {
  it("some() wraps a present value", () => {
    expect(isSome(some(5))).toBe(true);
  });

  it("none represents absence", () => {
    expect(isNone(none)).toBe(true);
  });

  it("fromNullable converts null/undefined to none, everything else to some", () => {
    expect(isNone(fromNullable(null))).toBe(true);
    expect(isNone(fromNullable(undefined))).toBe(true);
    expect(isSome(fromNullable(0))).toBe(true);
  });

  it("getOrElse returns the fallback when none", () => {
    expect(getOrElse(none, "fallback")).toBe("fallback");
    expect(getOrElse(some("value"), "fallback")).toBe("value");
  });

  it("mapOption transforms only a present value", () => {
    expect(mapOption(some(2), (n) => n * 5)).toEqual(some(10));
    expect(mapOption(none, (n: number) => n * 5)).toEqual(none);
  });
});
