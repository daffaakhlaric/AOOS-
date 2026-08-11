import { describe, expect, it } from "vitest";

import { CampaignDecision } from "../../../../src/domain/entities/CampaignDecision.js";
import { ExecutionPlan } from "../../../../src/domain/entities/ExecutionPlan.js";
import { ConfidenceScore } from "../../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionId } from "../../../../src/domain/value-objects/DecisionId.js";
import { DecisionReason } from "../../../../src/domain/value-objects/DecisionReason.js";
import { DecisionType } from "../../../../src/domain/value-objects/DecisionType.js";
import { ExecutionPlanId } from "../../../../src/domain/value-objects/ExecutionPlanId.js";
import { ImpactEstimate } from "../../../../src/domain/value-objects/ImpactEstimate.js";
import { unwrap } from "../../../helpers/result.js";

function decisionOf(decisionType: DecisionType): CampaignDecision {
  return unwrap(
    CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: "t",
      targetType: "ad",
      actionKind: "PAUSE",
      decisionType,
      reason: unwrap(DecisionReason.create("r")),
      confidence: unwrap(ConfidenceScore.create(80)),
      impact: unwrap(ImpactEstimate.create({ description: "d" })),
      createdAt: new Date("2026-08-09T00:00:00.000Z"),
    }),
  );
}

describe("ExecutionPlan", () => {
  it("creates a valid plan", () => {
    const result = ExecutionPlan.create({
      id: ExecutionPlanId.generate(),
      tenantId: "dss-motor",
      decisions: [],
      generatedAt: new Date(),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty tenantId", () => {
    const result = ExecutionPlan.create({
      id: ExecutionPlanId.generate(),
      tenantId: "",
      decisions: [],
      generatedAt: new Date(),
    });
    expect(result.ok).toBe(false);
  });

  it("filters decisions by type via the four convenience accessors", () => {
    const decisions = [
      decisionOf(DecisionType.AUTO_EXECUTE),
      decisionOf(DecisionType.ESCALATE),
      decisionOf(DecisionType.BRIEF_KAI),
      decisionOf(DecisionType.NO_ACTION),
      decisionOf(DecisionType.AUTO_EXECUTE),
    ];
    const generatedAt = new Date("2026-08-09T00:00:00.000Z");
    const id = ExecutionPlanId.generate();
    const plan = unwrap(
      ExecutionPlan.create({
        id,
        tenantId: "dss-motor",
        decisions,
        generatedAt,
      }),
    );
    expect(plan.autoExecuted()).toHaveLength(2);
    expect(plan.escalated()).toHaveLength(1);
    expect(plan.briefedToKai()).toHaveLength(1);
    expect(plan.noAction()).toHaveLength(1);
    expect(plan.decisions).toHaveLength(5);
    expect(plan.generatedAt).toEqual(generatedAt);
    expect(plan.id).toBe(id);
    expect(plan.tenantId).toBe("dss-motor");
  });
});
