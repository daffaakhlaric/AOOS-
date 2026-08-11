import { describe, expect, it } from "vitest";

import { CampaignDecision } from "../../../src/domain/entities/CampaignDecision.js";
import { ExecutionPlan } from "../../../src/domain/entities/ExecutionPlan.js";
import { ConfidenceScore } from "../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionId } from "../../../src/domain/value-objects/DecisionId.js";
import { DecisionReason } from "../../../src/domain/value-objects/DecisionReason.js";
import { DecisionType } from "../../../src/domain/value-objects/DecisionType.js";
import { ExecutionPlanId } from "../../../src/domain/value-objects/ExecutionPlanId.js";
import { ImpactEstimate } from "../../../src/domain/value-objects/ImpactEstimate.js";
import { DecisionRegistry } from "../../../src/registry/DecisionRegistry.js";
import { unwrap } from "../../helpers/result.js";

function decision() {
  return unwrap(
    CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: "t",
      targetType: "ad",
      actionKind: "PAUSE",
      decisionType: DecisionType.AUTO_EXECUTE,
      reason: unwrap(DecisionReason.create("r")),
      confidence: unwrap(ConfidenceScore.create(80)),
      impact: unwrap(ImpactEstimate.create({ description: "d" })),
      createdAt: new Date(),
    }),
  );
}

function plan(tenantId: string, decisions = [decision()]) {
  return unwrap(
    ExecutionPlan.create({
      id: ExecutionPlanId.generate(),
      tenantId,
      decisions,
      generatedAt: new Date(),
    }),
  );
}

describe("DecisionRegistry", () => {
  it("savePlan + getPlan round-trips a plan", () => {
    const registry = new DecisionRegistry();
    const p = plan("dss-motor");
    registry.savePlan(p);
    const found = registry.getPlan(p.id.toString());
    expect(found.some).toBe(true);
  });

  it("getPlan returns none for an unknown id", () => {
    expect(new DecisionRegistry().getPlan("unknown").some).toBe(false);
  });

  it("listPlansByTenant filters by tenantId", () => {
    const registry = new DecisionRegistry();
    registry.savePlan(plan("dss-motor"));
    registry.savePlan(plan("other-tenant"));
    expect(registry.listPlansByTenant("dss-motor")).toHaveLength(1);
  });

  it("findDecision locates a decision nested inside a saved plan", () => {
    const registry = new DecisionRegistry();
    const d = decision();
    registry.savePlan(plan("dss-motor", [d]));
    const found = registry.findDecision(d.id.toString());
    expect(found.some).toBe(true);
    expect(found.some && found.value).toBe(d);
  });

  it("findDecision returns none when no plan contains the decision", () => {
    const registry = new DecisionRegistry();
    registry.savePlan(plan("dss-motor"));
    expect(registry.findDecision("unknown").some).toBe(false);
  });
});
