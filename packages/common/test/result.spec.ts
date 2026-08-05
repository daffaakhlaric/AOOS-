import { describe, expect, it } from "vitest";

import { err, isErr, isOk, mapErr, mapResult, ok, unwrap, unwrapOr } from "../src/result.js";

describe("Result", () => {
  it("ok() creates a success result", () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(unwrap(result)).toBe(42);
  });

  it("err() creates a failure result", () => {
    const result = err("boom");
    expect(isErr(result)).toBe(true);
  });

  it("unwrap throws the wrapped error on failure", () => {
    const result = err(new Error("boom"));
    expect(() => unwrap(result)).toThrow("boom");
  });

  it("unwrapOr returns the fallback on failure", () => {
    expect(unwrapOr(err("nope"), 99)).toBe(99);
    expect(unwrapOr(ok(1), 99)).toBe(1);
  });

  it("mapResult transforms only the success branch", () => {
    expect(unwrap(mapResult(ok(2), (n) => n * 10))).toBe(20);
    const failure = err<string>("fail");
    expect(mapResult(failure, (n: number) => n * 10)).toBe(failure);
  });

  it("mapErr transforms only the failure branch", () => {
    const mapped = mapErr(err("boom"), (e) => `wrapped: ${e}`);
    expect(isErr(mapped) && mapped.error).toBe("wrapped: boom");
  });
});
