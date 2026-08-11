import { describe, expect, it } from "vitest";

import { ProgressPercentage } from "../../../../src/domain/value-objects/ProgressPercentage.js";
import { unwrap } from "../../../helpers/result.js";

describe("ProgressPercentage", () => {
  it("creates a valid percentage", () => {
    expect(unwrap(ProgressPercentage.create(24)).toNumber()).toBe(24);
  });

  it("creates the boundary value 0", () => {
    expect(unwrap(ProgressPercentage.create(0)).toNumber()).toBe(0);
  });

  it("creates the boundary value 100", () => {
    expect(unwrap(ProgressPercentage.create(100)).toNumber()).toBe(100);
  });

  it("rejects a negative percentage", () => {
    expect(ProgressPercentage.create(-1).ok).toBe(false);
  });

  it("rejects a percentage above 100", () => {
    expect(ProgressPercentage.create(101).ok).toBe(false);
  });

  it("rejects NaN", () => {
    expect(ProgressPercentage.create(NaN).ok).toBe(false);
  });

  it("rejects a non-number", () => {
    expect(ProgressPercentage.create("50" as unknown as number).ok).toBe(false);
  });

  it("fromCounts computes the correct percentage", () => {
    expect(ProgressPercentage.fromCounts(12, 50).toNumber()).toBe(24);
  });

  it("fromCounts clamps at 100 when currentHotLeads exceeds target", () => {
    expect(ProgressPercentage.fromCounts(60, 50).toNumber()).toBe(100);
  });

  it("fromCounts clamps at 0 for a negative currentHotLeads", () => {
    expect(ProgressPercentage.fromCounts(-5, 50).toNumber()).toBe(0);
  });

  it("isComplete is true at 100%", () => {
    expect(unwrap(ProgressPercentage.create(100)).isComplete()).toBe(true);
  });

  it("isComplete is false below 100%", () => {
    expect(unwrap(ProgressPercentage.create(99)).isComplete()).toBe(false);
  });

  it("equals compares values", () => {
    const a = unwrap(ProgressPercentage.create(50));
    const b = unwrap(ProgressPercentage.create(50));
    const c = unwrap(ProgressPercentage.create(60));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
