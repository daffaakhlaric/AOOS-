import { describe, expect, it } from "vitest";

import type { ClockFn, Id, Metadata } from "../../src/types/common.js";

describe("common type aliases", () => {
  it("Id is usable as a plain string", () => {
    const id: Id = "abc-123";
    expect(typeof id).toBe("string");
  });

  it("Metadata is usable as a readonly record", () => {
    const metadata: Metadata = { a: 1, b: "two" };
    expect(metadata.a).toBe(1);
  });

  it("ClockFn is a callable returning a number", () => {
    const clock: ClockFn = () => 12345;
    expect(clock()).toBe(12345);
  });
});
