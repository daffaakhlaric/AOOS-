import { describe, expect, it } from "vitest";

import { DurationSeconds } from "../../../src/domain/value-objects/DurationSeconds.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("DurationSeconds", () => {
  it("accepts 5", () => {
    expect(unwrap(DurationSeconds.create(5)).seconds).toBe(5);
  });

  it("accepts 8", () => {
    expect(unwrap(DurationSeconds.create(8)).seconds).toBe(8);
  });

  it("rejects 7 (valid: 5, 8 only)", () => {
    const error = unwrapErr(DurationSeconds.create(7));
    expect(error.message).toMatch(/must be 5 or 8/);
  });

  it("rejects 6", () => {
    const error = unwrapErr(DurationSeconds.create(6));
    expect(error.message).toMatch(/must be 5 or 8/);
  });

  it("rejects 0", () => {
    const error = unwrapErr(DurationSeconds.create(0));
    expect(error.message).toMatch(/must be 5 or 8/);
  });

  it("rejects a non-number value", () => {
    const error = unwrapErr(DurationSeconds.create("5" as unknown as number));
    expect(error.message).toMatch(/must be 5 or 8/);
  });

  it("two DurationSeconds with the same value are equal", () => {
    const a = unwrap(DurationSeconds.create(8));
    const b = unwrap(DurationSeconds.create(8));
    expect(a.equals(b)).toBe(true);
    expect(a.toString()).toBe("8");
  });
});
