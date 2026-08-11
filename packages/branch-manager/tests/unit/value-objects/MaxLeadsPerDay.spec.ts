import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_LEADS_PER_DAY,
  MaxLeadsPerDay,
} from "../../../src/domain/value-objects/MaxLeadsPerDay.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("MaxLeadsPerDay", () => {
  it("creates at the minimum bound (1)", () => {
    expect(unwrap(MaxLeadsPerDay.create(1)).toNumber()).toBe(1);
  });

  it("creates at the maximum bound (50)", () => {
    expect(unwrap(MaxLeadsPerDay.create(50)).toNumber()).toBe(50);
  });

  it("creates a mid-range value", () => {
    expect(unwrap(MaxLeadsPerDay.create(10)).toNumber()).toBe(10);
  });

  it("rejects below the minimum (0)", () => {
    expect(unwrapErr(MaxLeadsPerDay.create(0)).message).toContain("must be between 1 and 50");
  });

  it("rejects above the maximum (51)", () => {
    expect(unwrapErr(MaxLeadsPerDay.create(51)).message).toContain("must be between 1 and 50");
  });

  it("rejects a non-integer", () => {
    expect(unwrapErr(MaxLeadsPerDay.create(5.5)).message).toContain("must be an integer");
  });

  it("rejects a non-number", () => {
    expect(unwrapErr(MaxLeadsPerDay.create(undefined as unknown as number)).message).toContain(
      "must be an integer",
    );
  });

  it("default() is the spec's default of 10", () => {
    expect(MaxLeadsPerDay.default().toNumber()).toBe(DEFAULT_MAX_LEADS_PER_DAY);
    expect(MaxLeadsPerDay.default().toNumber()).toBe(10);
  });

  it("equals compares by value", () => {
    expect(unwrap(MaxLeadsPerDay.create(10)).equals(MaxLeadsPerDay.default())).toBe(true);
    expect(unwrap(MaxLeadsPerDay.create(10)).equals(unwrap(MaxLeadsPerDay.create(11)))).toBe(false);
  });
});
