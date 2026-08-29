import { Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DailyDigestBuilder } from "../../../src/builders/DailyDigestBuilder.js";
import { CampaignDecision } from "../../../src/domain/entities/CampaignDecision.js";
import { ExecutionPlan } from "../../../src/domain/entities/ExecutionPlan.js";
import { ConfidenceScore } from "../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionId } from "../../../src/domain/value-objects/DecisionId.js";
import { DecisionReason } from "../../../src/domain/value-objects/DecisionReason.js";
import { DecisionType } from "../../../src/domain/value-objects/DecisionType.js";
import { ExecutionPlanId } from "../../../src/domain/value-objects/ExecutionPlanId.js";
import { ImpactEstimate } from "../../../src/domain/value-objects/ImpactEstimate.js";
import { buildObjectiveProgressFixture } from "../../fixtures/objectiveFixtures.js";
import { unwrap } from "../../helpers/result.js";

const now = new Date("2026-08-09T00:00:00.000Z");

function fixDecision(targetId: string): CampaignDecision {
  return unwrap(
    CampaignDecision.create({
      id: DecisionId.generate(),
      targetId,
      targetType: "campaign",
      actionKind: "FIX",
      decisionType: DecisionType.AUTO_EXECUTE,
      verdict: Verdict.FIX,
      reason: unwrap(DecisionReason.create("Objective salah selalu perlu diperbaiki")),
      confidence: unwrap(ConfidenceScore.create(90)),
      impact: unwrap(ImpactEstimate.create({ description: "Objective diperbaiki" })),
      createdAt: now,
    }),
  );
}

/**
 * AAOS-W1D-S3, coordinator note correction #5: the real, current FIX digest line is
 * `` `Fix objective ${fix.targetId}` `` (packages/meta-ads-agent/src/builders/
 * DailyDigestBuilder.ts) — extended by this supplement to mention OUTCOME_LEADS + CTWA + Clara,
 * NOT the spec's own inaccurate paraphrase ("Fix objective ke CONVERSATIONS").
 */
describe("DailyDigestBuilder — FIX summary line (AAOS-W1D-S3)", () => {
  it("mentions OUTCOME_LEADS + CTWA", () => {
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [fixDecision("campaign-1")],
        generatedAt: now,
      }),
    );
    const result = DailyDigestBuilder.build({
      tenantId: "dss-motor",
      date: now,
      targetHotLeads: 50,
      budgetAllocationIDR: 30_000_000,
      progress: buildObjectiveProgressFixture(),
      plan,
      creativeBriefs: [],
      escalations: [],
      adFindings: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fixLine = result.value.autoExecutedSummaryLines.find((l) => l.includes("campaign-1"));
    expect(fixLine).toBeDefined();
    expect(fixLine).toContain("OUTCOME_LEADS");
    expect(fixLine).toContain("CTWA");
  });

  it("mentions Clara", () => {
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [fixDecision("campaign-2")],
        generatedAt: now,
      }),
    );
    const result = DailyDigestBuilder.build({
      tenantId: "dss-motor",
      date: now,
      targetHotLeads: 50,
      budgetAllocationIDR: 30_000_000,
      progress: buildObjectiveProgressFixture(),
      plan,
      creativeBriefs: [],
      escalations: [],
      adFindings: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fixLine = result.value.autoExecutedSummaryLines.find((l) => l.includes("campaign-2"));
    expect(fixLine).toContain("Clara");
  });

  it("still starts with the real, unchanged 'Fix objective {targetId}' prefix (extends, doesn't replace, the real line — coordinator note correction #5)", () => {
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [fixDecision("campaign-3")],
        generatedAt: now,
      }),
    );
    const result = DailyDigestBuilder.build({
      tenantId: "dss-motor",
      date: now,
      targetHotLeads: 50,
      budgetAllocationIDR: 30_000_000,
      progress: buildObjectiveProgressFixture(),
      plan,
      creativeBriefs: [],
      escalations: [],
      adFindings: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fixLine = result.value.autoExecutedSummaryLines.find((l) => l.includes("campaign-3"));
    expect(fixLine?.startsWith("Fix objective campaign-3")).toBe(true);
  });

  it("lists one FIX line per FIX decision when multiple are present", () => {
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [fixDecision("campaign-4"), fixDecision("campaign-5")],
        generatedAt: now,
      }),
    );
    const result = DailyDigestBuilder.build({
      tenantId: "dss-motor",
      date: now,
      targetHotLeads: 50,
      budgetAllocationIDR: 30_000_000,
      progress: buildObjectiveProgressFixture(),
      plan,
      creativeBriefs: [],
      escalations: [],
      adFindings: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.autoExecutedSummaryLines.filter((l) => l.includes("OUTCOME_LEADS")),
    ).toHaveLength(2);
  });
});
