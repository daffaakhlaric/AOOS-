import { describe, expect, it } from "vitest";

import { DailyLeadCount } from "../../../src/domain/value-objects/DailyLeadCount.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("DailyLeadCount", () => {
  it("creates from a non-negative integer", () => {
    expect(unwrap(DailyLeadCount.create(5)).toNumber()).toBe(5);
  });

  it("zero() is 0", () => {
    expect(DailyLeadCount.zero().toNumber()).toBe(0);
  });

  it("rejects a negative number", () => {
    expect(unwrapErr(DailyLeadCount.create(-1)).message).toContain("not be negative");
  });

  it("rejects a non-integer", () => {
    expect(unwrapErr(DailyLeadCount.create(1.1)).message).toContain("must be an integer");
  });

  it("rejects a non-number", () => {
    expect(unwrapErr(DailyLeadCount.create(null as unknown as number)).message).toContain(
      "must be an integer",
    );
  });

  it("increment() adds 1", () => {
    expect(DailyLeadCount.zero().increment().toNumber()).toBe(1);
  });

  it("equals compares by value", () => {
    expect(unwrap(DailyLeadCount.create(4)).equals(unwrap(DailyLeadCount.create(4)))).toBe(true);
    expect(unwrap(DailyLeadCount.create(4)).equals(unwrap(DailyLeadCount.create(5)))).toBe(false);
  });
});
