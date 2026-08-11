import { describe, expect, it } from "vitest";

import { TamaraRecommendation } from "../../../../src/domain/entities/TamaraRecommendation.js";
import { EstimatedImpact } from "../../../../src/domain/value-objects/EstimatedImpact.js";
import { ObjectiveId } from "../../../../src/domain/value-objects/ObjectiveId.js";
import { RecommendedAction } from "../../../../src/domain/value-objects/RecommendedAction.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

function validAction() {
  return unwrap(
    RecommendedAction.create({
      type: "SCALE",
      targetId: "ad-1",
      targetType: "ad",
      targetName: "#C047 Gudangnya Xpander",
      reason: "cheap",
      estimatedLeadGain: 5,
      priority: 2,
    }),
  );
}

function validProps() {
  return {
    objectiveId: ObjectiveId.generate(),
    generatedAt: new Date("2026-08-09T00:00:00.000Z"),
    summary: "Tamara merekomendasikan scale.",
    actions: [validAction()],
    estimatedImpact: unwrap(
      EstimatedImpact.create({
        additionalLeadsEstimate: 5,
        budgetSavingEstimate: 0,
        targetGapClosedPercentage: 10,
      }),
    ),
    confidence: 80,
  };
}

describe("TamaraRecommendation", () => {
  it("creates a valid TamaraRecommendation", () => {
    const rec = unwrap(TamaraRecommendation.create(validProps()));
    expect(rec.summary).toBe("Tamara merekomendasikan scale.");
    expect(rec.actions.length).toBe(1);
    expect(rec.confidence).toBe(80);
  });

  it("exposes every getter matching constructed props", () => {
    const props = validProps();
    const rec = unwrap(TamaraRecommendation.create(props));
    expect(rec.objectiveId).toBe(props.objectiveId);
    expect(rec.generatedAt).toBe(props.generatedAt);
    expect(rec.estimatedImpact).toBe(props.estimatedImpact);
  });

  it("rejects an empty summary", () => {
    expect(
      unwrapErr(TamaraRecommendation.create({ ...validProps(), summary: "" })).message,
    ).toContain("summary");
  });

  it("rejects a whitespace-only summary", () => {
    expect(TamaraRecommendation.create({ ...validProps(), summary: "   " }).ok).toBe(false);
  });

  it("rejects a non-string summary", () => {
    expect(
      TamaraRecommendation.create({ ...validProps(), summary: 5 as unknown as string }).ok,
    ).toBe(false);
  });

  it("rejects confidence below 0", () => {
    expect(TamaraRecommendation.create({ ...validProps(), confidence: -1 }).ok).toBe(false);
  });

  it("rejects confidence above 100", () => {
    expect(TamaraRecommendation.create({ ...validProps(), confidence: 101 }).ok).toBe(false);
  });

  it("rejects a non-finite confidence", () => {
    expect(TamaraRecommendation.create({ ...validProps(), confidence: NaN }).ok).toBe(false);
  });

  it("accepts an empty actions array", () => {
    expect(TamaraRecommendation.create({ ...validProps(), actions: [] }).ok).toBe(true);
  });

  it("accepts confidence boundary values 0 and 100", () => {
    expect(TamaraRecommendation.create({ ...validProps(), confidence: 0 }).ok).toBe(true);
    expect(TamaraRecommendation.create({ ...validProps(), confidence: 100 }).ok).toBe(true);
  });

  it("defensively copies the actions array — external mutation does not affect the entity", () => {
    const actions = [validAction()];
    const rec = unwrap(TamaraRecommendation.create({ ...validProps(), actions }));
    actions.push(validAction());
    expect(rec.actions.length).toBe(1);
  });
});
