import { Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { CampaignDecision } from "../../../../src/domain/entities/CampaignDecision.js";
import { ConfidenceScore } from "../../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionId } from "../../../../src/domain/value-objects/DecisionId.js";
import { DecisionReason } from "../../../../src/domain/value-objects/DecisionReason.js";
import { DecisionType } from "../../../../src/domain/value-objects/DecisionType.js";
import { ImpactEstimate } from "../../../../src/domain/value-objects/ImpactEstimate.js";
import { unwrap } from "../../../helpers/result.js";

function baseProps() {
  return {
    id: DecisionId.generate(),
    targetId: "ad-1",
    targetType: "ad" as const,
    actionKind: "PAUSE" as const,
    decisionType: DecisionType.AUTO_EXECUTE,
    verdict: Verdict.PAUSE,
    reason: unwrap(DecisionReason.create("boros")),
    confidence: unwrap(ConfidenceScore.create(90)),
    impact: unwrap(ImpactEstimate.create({ description: "hemat" })),
    createdAt: new Date("2026-08-09T00:00:00.000Z"),
  };
}

describe("CampaignDecision", () => {
  it("creates a valid decision", () => {
    const result = CampaignDecision.create(baseProps());
    expect(result.ok).toBe(true);
  });

  it("rejects an empty targetId", () => {
    const result = CampaignDecision.create({ ...baseProps(), targetId: "" });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid decisionType", () => {
    const result = CampaignDecision.create({
      ...baseProps(),
      decisionType: "BOGUS" as never,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a fractional budgetChangeIDR", () => {
    const result = CampaignDecision.create({ ...baseProps(), budgetChangeIDR: 1.5 });
    expect(result.ok).toBe(false);
  });

  it("rejects a negative spendIDR", () => {
    const result = CampaignDecision.create({ ...baseProps(), spendIDR: -1 });
    expect(result.ok).toBe(false);
  });

  it("accepts a valid budgetChangeIDR and currentDailyBudgetIDR", () => {
    const result = CampaignDecision.create({
      ...baseProps(),
      budgetChangeIDR: 100_000,
      currentDailyBudgetIDR: 500_000,
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.budgetChangeIDR).toBe(100_000);
    expect(result.ok && result.value.currentDailyBudgetIDR).toBe(500_000);
  });

  it("exposes every getter", () => {
    const props = baseProps();
    const decision = unwrap(CampaignDecision.create(props));
    expect(decision.id).toBe(props.id);
    expect(decision.targetId).toBe("ad-1");
    expect(decision.targetType).toBe("ad");
    expect(decision.actionKind).toBe("PAUSE");
    expect(decision.decisionType).toBe(DecisionType.AUTO_EXECUTE);
    expect(decision.verdict).toBe(Verdict.PAUSE);
    expect(decision.reason.toString()).toBe("boros");
    expect(decision.confidence.toNumber()).toBe(90);
    expect(decision.impact.description).toBe("hemat");
    expect(decision.spendIDR).toBeUndefined();
    expect(decision.createdAt).toEqual(props.createdAt);
  });

  it("isAutoExecutable/isEscalation/isBriefKai classify correctly", () => {
    const autoExec = unwrap(CampaignDecision.create(baseProps()));
    expect(autoExec.isAutoExecutable()).toBe(true);
    expect(autoExec.isEscalation()).toBe(false);
    expect(autoExec.isBriefKai()).toBe(false);

    const escalated = unwrap(
      CampaignDecision.create({ ...baseProps(), decisionType: DecisionType.ESCALATE }),
    );
    expect(escalated.isEscalation()).toBe(true);

    const briefed = unwrap(
      CampaignDecision.create({ ...baseProps(), decisionType: DecisionType.BRIEF_KAI }),
    );
    expect(briefed.isBriefKai()).toBe(true);
  });
});
