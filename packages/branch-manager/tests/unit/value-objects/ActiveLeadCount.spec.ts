import { describe, expect, it } from "vitest";

import { ActiveLeadCount } from "../../../src/domain/value-objects/ActiveLeadCount.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("ActiveLeadCount", () => {
  it("creates from a non-negative integer", () => {
    expect(unwrap(ActiveLeadCount.create(3)).toNumber()).toBe(3);
  });

  it("zero() is 0", () => {
    expect(ActiveLeadCount.zero().toNumber()).toBe(0);
  });

  it("rejects a negative number", () => {
    expect(unwrapErr(ActiveLeadCount.create(-1)).message).toContain("not be negative");
  });

  it("rejects a non-integer", () => {
    expect(unwrapErr(ActiveLeadCount.create(1.5)).message).toContain("must be an integer");
  });

  it("rejects a non-number", () => {
    expect(unwrapErr(ActiveLeadCount.create("3" as unknown as number)).message).toContain(
      "must be an integer",
    );
  });

  it("increment() adds 1", () => {
    expect(ActiveLeadCount.zero().increment().toNumber()).toBe(1);
  });

  it("decrement() subtracts 1", () => {
    expect(unwrap(ActiveLeadCount.create(3)).decrement().toNumber()).toBe(2);
  });

  it("decrement() clamps at 0", () => {
    expect(ActiveLeadCount.zero().decrement().toNumber()).toBe(0);
  });

  it("equals compares by value", () => {
    expect(unwrap(ActiveLeadCount.create(2)).equals(unwrap(ActiveLeadCount.create(2)))).toBe(true);
    expect(unwrap(ActiveLeadCount.create(2)).equals(unwrap(ActiveLeadCount.create(3)))).toBe(false);
  });
});
