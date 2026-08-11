import { describe, expect, it } from "vitest";

import { ScoreDelta } from "../../../../src/domain/value-objects/ScoreDelta.js";

describe("ScoreDelta", () => {
  it("of() carries criterion and amount", () => {
    const delta = ScoreDelta.of("BUDGET", 25);
    expect(delta.criterion).toBe("BUDGET");
    expect(delta.amount).toBe(25);
  });

  it("isPositive is true for a positive amount", () => {
    expect(ScoreDelta.of("UNIT", 25).isPositive).toBe(true);
  });

  it("isPositive is false for a negative amount", () => {
    expect(ScoreDelta.of("NOT_SERIOUS", -20).isPositive).toBe(false);
  });

  it("isPositive is false for a zero amount", () => {
    expect(ScoreDelta.of("NO_REPLY", 0).isPositive).toBe(false);
  });
});
