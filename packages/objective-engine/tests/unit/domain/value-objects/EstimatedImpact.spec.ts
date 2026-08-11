import { describe, expect, it } from "vitest";

import { EstimatedImpact } from "../../../../src/domain/value-objects/EstimatedImpact.js";
import { unwrap } from "../../../helpers/result.js";

describe("EstimatedImpact", () => {
  it("creates a valid impact", () => {
    const impact = unwrap(
      EstimatedImpact.create({
        additionalLeadsEstimate: 8,
        budgetSavingEstimate: 1_200_000,
        targetGapClosedPercentage: 21,
      }),
    );
    expect(impact.additionalLeadsEstimate).toBe(8);
    expect(impact.budgetSavingEstimate).toBe(1_200_000);
    expect(impact.targetGapClosedPercentage).toBe(21);
  });

  it("rejects a negative additionalLeadsEstimate", () => {
    expect(
      EstimatedImpact.create({
        additionalLeadsEstimate: -1,
        budgetSavingEstimate: 0,
        targetGapClosedPercentage: 0,
      }).ok,
    ).toBe(false);
  });

  it("rejects a non-finite additionalLeadsEstimate", () => {
    expect(
      EstimatedImpact.create({
        additionalLeadsEstimate: NaN,
        budgetSavingEstimate: 0,
        targetGapClosedPercentage: 0,
      }).ok,
    ).toBe(false);
  });

  it("rejects a negative budgetSavingEstimate", () => {
    expect(
      EstimatedImpact.create({
        additionalLeadsEstimate: 0,
        budgetSavingEstimate: -1,
        targetGapClosedPercentage: 0,
      }).ok,
    ).toBe(false);
  });

  it("rejects a non-finite budgetSavingEstimate", () => {
    expect(
      EstimatedImpact.create({
        additionalLeadsEstimate: 0,
        budgetSavingEstimate: NaN,
        targetGapClosedPercentage: 0,
      }).ok,
    ).toBe(false);
  });

  it("rejects a negative targetGapClosedPercentage", () => {
    expect(
      EstimatedImpact.create({
        additionalLeadsEstimate: 0,
        budgetSavingEstimate: 0,
        targetGapClosedPercentage: -1,
      }).ok,
    ).toBe(false);
  });

  it("rejects a targetGapClosedPercentage above 100", () => {
    expect(
      EstimatedImpact.create({
        additionalLeadsEstimate: 0,
        budgetSavingEstimate: 0,
        targetGapClosedPercentage: 101,
      }).ok,
    ).toBe(false);
  });

  it("rejects a non-finite targetGapClosedPercentage", () => {
    expect(
      EstimatedImpact.create({
        additionalLeadsEstimate: 0,
        budgetSavingEstimate: 0,
        targetGapClosedPercentage: NaN,
      }).ok,
    ).toBe(false);
  });
});
