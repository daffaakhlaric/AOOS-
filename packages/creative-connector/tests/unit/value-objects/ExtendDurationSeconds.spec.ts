import { describe, expect, it } from "vitest";

import { ExtendDurationSeconds } from "../../../src/domain/value-objects/ExtendDurationSeconds.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("ExtendDurationSeconds", () => {
  it("accepts 1 (min)", () => {
    expect(unwrap(ExtendDurationSeconds.create(1)).seconds).toBe(1);
  });

  it("accepts 8 (max)", () => {
    expect(unwrap(ExtendDurationSeconds.create(8)).seconds).toBe(8);
  });

  // Design resolution #3: the spec's own pinned long-video arithmetic requires these exact
  // "odd" extend durations (7, 6) to validate successfully — proof this VO is NOT DurationSeconds.
  it("accepts 7 (15s long-video example)", () => {
    expect(unwrap(ExtendDurationSeconds.create(7)).seconds).toBe(7);
  });

  it("accepts 6 (30s long-video example)", () => {
    expect(unwrap(ExtendDurationSeconds.create(6)).seconds).toBe(6);
  });

  it("rejects 0", () => {
    const error = unwrapErr(ExtendDurationSeconds.create(0));
    expect(error.message).toMatch(/integer from 1 to 8/);
  });

  it("rejects 9", () => {
    const error = unwrapErr(ExtendDurationSeconds.create(9));
    expect(error.message).toMatch(/integer from 1 to 8/);
  });

  it("rejects a non-integer", () => {
    const error = unwrapErr(ExtendDurationSeconds.create(4.5));
    expect(error.message).toMatch(/integer from 1 to 8/);
  });

  it("rejects a non-number value", () => {
    const error = unwrapErr(ExtendDurationSeconds.create("7" as unknown as number));
    expect(error.message).toMatch(/integer from 1 to 8/);
  });

  it("two ExtendDurationSeconds with the same value are equal", () => {
    const a = unwrap(ExtendDurationSeconds.create(7));
    const b = unwrap(ExtendDurationSeconds.create(7));
    expect(a.equals(b)).toBe(true);
    expect(a.toString()).toBe("7");
  });
});
