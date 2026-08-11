import { describe, expect, it } from "vitest";

import { costPerHotLead, costPerSPK } from "../../../src/calculators/RoiCalculator.js";

describe("costPerHotLead", () => {
  it("computes spend / hotLeadsCount", () => {
    expect(costPerHotLead(30_000_000, 50)).toBe(600_000);
  });

  it("returns null when hotLeadsCount is 0 (never NaN/Infinity)", () => {
    expect(costPerHotLead(30_000_000, 0)).toBeNull();
  });

  it("returns null when hotLeadsCount is negative", () => {
    expect(costPerHotLead(30_000_000, -1)).toBeNull();
  });

  it("returns null when spend is non-finite", () => {
    expect(costPerHotLead(Infinity, 50)).toBeNull();
  });

  it("returns null when hotLeadsCount is non-finite", () => {
    expect(costPerHotLead(30_000_000, NaN)).toBeNull();
  });

  it("returns null when the division result overflows to Infinity despite finite inputs", () => {
    expect(costPerHotLead(Number.MAX_VALUE, Number.MIN_VALUE)).toBeNull();
  });
});

describe("costPerSPK", () => {
  it("computes spend / spkCount", () => {
    expect(costPerSPK(30_000_000, 10)).toBe(3_000_000);
  });

  it("returns null when spkCount is 0", () => {
    expect(costPerSPK(30_000_000, 0)).toBeNull();
  });

  it("returns null when spkCount is negative", () => {
    expect(costPerSPK(30_000_000, -1)).toBeNull();
  });
});
