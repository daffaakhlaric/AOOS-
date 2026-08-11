import { describe, expect, it } from "vitest";

import { RecommendedAction } from "../../../../src/domain/value-objects/RecommendedAction.js";
import { unwrap } from "../../../helpers/result.js";

function validInput(overrides: Partial<Parameters<typeof RecommendedAction.create>[0]> = {}) {
  return {
    type: "PAUSE" as const,
    targetId: "ad-1",
    targetType: "ad" as const,
    targetName: "#C001 Test Ad",
    reason: "Too expensive",
    priority: 1 as const,
    ...overrides,
  };
}

describe("RecommendedAction", () => {
  it("creates a valid PAUSE action", () => {
    const action = unwrap(RecommendedAction.create(validInput()));
    expect(action.type).toBe("PAUSE");
    expect(action.targetId).toBe("ad-1");
    expect(action.targetType).toBe("ad");
    expect(action.targetName).toBe("#C001 Test Ad");
    expect(action.reason).toBe("Too expensive");
    expect(action.priority).toBe(1);
    expect(action.estimatedLeadGain).toBeUndefined();
    expect(action.estimatedBudgetSaving).toBeUndefined();
  });

  it("creates every valid action type", () => {
    for (const type of ["SCALE", "PAUSE", "FIX", "REFRESH", "REALLOCATE"] as const) {
      expect(unwrap(RecommendedAction.create(validInput({ type }))).type).toBe(type);
    }
  });

  it("creates every valid target type", () => {
    for (const targetType of ["campaign", "adset", "ad"] as const) {
      expect(unwrap(RecommendedAction.create(validInput({ targetType }))).targetType).toBe(
        targetType,
      );
    }
  });

  it("creates every valid priority", () => {
    for (const priority of [1, 2, 3] as const) {
      expect(unwrap(RecommendedAction.create(validInput({ priority }))).priority).toBe(priority);
    }
  });

  it("carries optional estimatedLeadGain/estimatedBudgetSaving", () => {
    const action = unwrap(
      RecommendedAction.create(
        validInput({ type: "SCALE", estimatedLeadGain: 8, estimatedBudgetSaving: 1_200_000 }),
      ),
    );
    expect(action.estimatedLeadGain).toBe(8);
    expect(action.estimatedBudgetSaving).toBe(1_200_000);
  });

  it("rejects an invalid type", () => {
    expect(RecommendedAction.create(validInput({ type: "BOGUS" as never })).ok).toBe(false);
  });

  it("rejects an invalid targetType", () => {
    expect(RecommendedAction.create(validInput({ targetType: "bogus" as never })).ok).toBe(false);
  });

  it("rejects an empty targetId", () => {
    expect(RecommendedAction.create(validInput({ targetId: "" })).ok).toBe(false);
  });

  it("rejects an empty targetName", () => {
    expect(RecommendedAction.create(validInput({ targetName: "" })).ok).toBe(false);
  });

  it("rejects an empty reason", () => {
    expect(RecommendedAction.create(validInput({ reason: "" })).ok).toBe(false);
  });

  it("rejects an invalid priority", () => {
    expect(RecommendedAction.create(validInput({ priority: 4 as never })).ok).toBe(false);
  });

  it("rejects a negative estimatedLeadGain", () => {
    expect(RecommendedAction.create(validInput({ estimatedLeadGain: -1 })).ok).toBe(false);
  });

  it("rejects a non-finite estimatedLeadGain", () => {
    expect(RecommendedAction.create(validInput({ estimatedLeadGain: NaN })).ok).toBe(false);
  });

  it("rejects a negative estimatedBudgetSaving", () => {
    expect(RecommendedAction.create(validInput({ estimatedBudgetSaving: -1 })).ok).toBe(false);
  });

  it("rejects a non-finite estimatedBudgetSaving", () => {
    expect(RecommendedAction.create(validInput({ estimatedBudgetSaving: NaN })).ok).toBe(false);
  });
});
