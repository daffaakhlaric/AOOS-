import { Branch, Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DailyDigestBuilder } from "../../../src/builders/DailyDigestBuilder.js";
import { CampaignDecision } from "../../../src/domain/entities/CampaignDecision.js";
import { CreativeBrief } from "../../../src/domain/entities/CreativeBrief.js";
import { EscalationRequest } from "../../../src/domain/entities/EscalationRequest.js";
import { ExecutionPlan } from "../../../src/domain/entities/ExecutionPlan.js";
import { AdAngle } from "../../../src/domain/value-objects/AdAngle.js";
import { ConfidenceScore } from "../../../src/domain/value-objects/ConfidenceScore.js";
import { CreativeBriefId } from "../../../src/domain/value-objects/CreativeBriefId.js";
import { DecisionId } from "../../../src/domain/value-objects/DecisionId.js";
import { DecisionReason } from "../../../src/domain/value-objects/DecisionReason.js";
import { DecisionType } from "../../../src/domain/value-objects/DecisionType.js";
import { ExecutionPlanId } from "../../../src/domain/value-objects/ExecutionPlanId.js";
import { ImpactEstimate } from "../../../src/domain/value-objects/ImpactEstimate.js";
import { TargetPersona } from "../../../src/domain/value-objects/TargetPersona.js";
import type { PerAdFinding } from "../../../src/types/AgentTypes.js";
import { buildObjectiveProgressFixture } from "../../fixtures/objectiveFixtures.js";
import { unwrap } from "../../helpers/result.js";

const now = new Date("2026-08-09T00:00:00.000Z");

function pauseDecision(spendIDR: number): CampaignDecision {
  return unwrap(
    CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: "ad-1",
      targetType: "ad",
      actionKind: "PAUSE",
      decisionType: DecisionType.AUTO_EXECUTE,
      verdict: Verdict.PAUSE,
      reason: unwrap(DecisionReason.create("boros")),
      confidence: unwrap(ConfidenceScore.create(90)),
      impact: unwrap(ImpactEstimate.create({ description: `hemat`, amountIDR: spendIDR })),
      spendIDR,
      createdAt: now,
    }),
  );
}

function scaleDecision(): CampaignDecision {
  return unwrap(
    CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: "adset-1",
      targetType: "adset",
      actionKind: "SCALE",
      decisionType: DecisionType.AUTO_EXECUTE,
      verdict: Verdict.SCALE,
      reason: unwrap(DecisionReason.create("scale")),
      confidence: unwrap(ConfidenceScore.create(90)),
      impact: unwrap(ImpactEstimate.create({ description: "naikkan" })),
      budgetChangeIDR: 400_000,
      createdAt: now,
    }),
  );
}

function scaleDecisionWithoutBudgetChange(): CampaignDecision {
  return unwrap(
    CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: "adset-2",
      targetType: "adset",
      actionKind: "SCALE",
      decisionType: DecisionType.AUTO_EXECUTE,
      verdict: Verdict.SCALE,
      reason: unwrap(DecisionReason.create("scale")),
      confidence: unwrap(ConfidenceScore.create(90)),
      impact: unwrap(ImpactEstimate.create({ description: "naikkan" })),
      createdAt: now,
    }),
  );
}

function reallocationDecisionWithoutBudgetChange(): CampaignDecision {
  return unwrap(
    CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: "realloc:2",
      targetType: "portfolio",
      actionKind: "REALLOCATE_BUDGET",
      decisionType: DecisionType.AUTO_EXECUTE,
      reason: unwrap(DecisionReason.create("realokasi")),
      confidence: unwrap(ConfidenceScore.create(90)),
      impact: unwrap(ImpactEstimate.create({ description: "Realokasi tanpa angka" })),
      createdAt: now,
    }),
  );
}

function reallocationDecision(): CampaignDecision {
  return unwrap(
    CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: "realloc:1",
      targetType: "portfolio",
      actionKind: "REALLOCATE_BUDGET",
      decisionType: DecisionType.AUTO_EXECUTE,
      reason: unwrap(DecisionReason.create("realokasi")),
      confidence: unwrap(ConfidenceScore.create(90)),
      impact: unwrap(ImpactEstimate.create({ description: "Realokasi dari Bandung ke Cinere" })),
      budgetChangeIDR: 1_500_000,
      createdAt: now,
    }),
  );
}

function findingFor(adId: string, rphChatIDR: number, conversations: number): PerAdFinding {
  return {
    adId,
    targetId: adId,
    targetType: "ad",
    verdict: Verdict.KEEP,
    branch: Branch.CINERE,
    unit: "Xpander",
    spendIDR: rphChatIDR * conversations,
    conversations,
    rphChatIDR,
    rphD3IDR: null,
  };
}

describe("DailyDigestBuilder.build", () => {
  it("digest contains the exact currentSpend figure from the ObjectiveProgress passed in", () => {
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [pauseDecision(400_000)],
        generatedAt: now,
      }),
    );
    const progress = buildObjectiveProgressFixture({ currentSpendIDR: 8_500_000 });
    const result = DailyDigestBuilder.build({
      tenantId: "dss-motor",
      date: now,
      targetHotLeads: 50,
      budgetAllocationIDR: 30_000_000,
      progress,
      plan,
      creativeBriefs: [],
      escalations: [],
      adFindings: [],
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.budgetSpentIDR).toBe(8_500_000);
    expect(result.ok && result.value.text).toContain("Rp 8.500.000");
  });

  it("defaults to Rp 0 in the summary line when a SCALE/REALLOCATE_BUDGET decision has no budgetChangeIDR", () => {
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [scaleDecisionWithoutBudgetChange(), reallocationDecisionWithoutBudgetChange()],
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
      result.value.autoExecutedSummaryLines.some((l) =>
        l.includes("Naikkan budget adset-2 (Rp 0)"),
      ),
    ).toBe(true);
    expect(
      result.value.autoExecutedSummaryLines.some((l) => l.includes("Realokasi tanpa angka (Rp 0)")),
    ).toBe(true);
  });

  it("correctly lists auto-executed decisions (PAUSE savings + SCALE budget increase)", () => {
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [
          pauseDecision(400_000),
          pauseDecision(600_000),
          scaleDecision(),
          reallocationDecision(),
        ],
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
      result.value.autoExecutedSummaryLines.some((l) => l.includes("Pause 2 iklan boros")),
    ).toBe(true);
    expect(result.value.autoExecutedSummaryLines.some((l) => l.includes("Rp 1.000.000"))).toBe(
      true,
    );
    expect(result.value.autoExecutedSummaryLines.some((l) => l.includes("Naikkan budget"))).toBe(
      true,
    );
    expect(
      result.value.autoExecutedSummaryLines.some((l) =>
        l.includes("Realokasi dari Bandung ke Cinere"),
      ),
    ).toBe(true);
  });

  it("correctly lists creative briefs sent", () => {
    const brief = unwrap(
      CreativeBrief.create({
        id: CreativeBriefId.generate(),
        adId: "ad-25",
        unit: "Xpander",
        branch: Branch.BINTARO,
        angle: AdAngle.DP_RINGAN,
        targetPersona: TargetPersona.PRIMARY_FAMILY,
        primaryMessage: "DP mulai 20 juta",
        tone: "casual",
        avoid: [],
        formats: ["VIDEO_15S"],
        reason: "frequency 4.9x, audience jenuh",
        urgency: "HIGH",
        estimatedImpactIfRefreshed: "target -40% Rp/D3",
        createdAt: now,
      }),
    );
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [],
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
      creativeBriefs: [brief],
      escalations: [],
      adFindings: [],
    });
    expect(result.ok).toBe(true);
    expect(
      result.ok &&
        result.value.creativeBriefSummaryLines.some(
          (l) => l.includes("#ad-25") && l.includes("DP_RINGAN"),
        ),
    ).toBe(true);
  });

  it("correctly lists pending escalations (excludes resolved ones)", () => {
    const decision = unwrap(
      CampaignDecision.create({
        id: DecisionId.generate(),
        targetId: "realloc:1",
        targetType: "portfolio",
        actionKind: "REALLOCATE_BUDGET",
        decisionType: DecisionType.ESCALATE,
        reason: unwrap(DecisionReason.create("Realokasi Rp 3.1 juta dari Bandung")),
        confidence: unwrap(ConfidenceScore.create(80)),
        impact: unwrap(ImpactEstimate.create({ description: "Realokasi dari Bandung ke Cinere" })),
        createdAt: now,
      }),
    );
    const pending = unwrap(
      EscalationRequest.create({ id: decision.id, decision, status: "PENDING", createdAt: now }),
    );
    const resolved = pending.approve(now, "daffa");

    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [],
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
      escalations: [pending, resolved],
      adFindings: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pendingEscalationSummaryLines).toHaveLength(1);
    expect(result.value.pendingEscalationSummaryLines[0]).toContain(
      "Realokasi dari Bandung ke Cinere",
    );
  });

  it("Indonesian text is generated (not empty)", () => {
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [],
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
    expect(result.ok && result.value.text.length).toBeGreaterThan(0);
  });

  it("weeklyRecommendation names the best/worst branch when 2+ branches have distinct rates", () => {
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [],
        generatedAt: now,
      }),
    );
    const findings = [
      { ...findingFor("a", 6_919, 10), branch: Branch.CINERE },
      { ...findingFor("b", 42_621, 10), branch: Branch.BANDUNG },
    ];
    const result = DailyDigestBuilder.build({
      tenantId: "dss-motor",
      date: now,
      targetHotLeads: 50,
      budgetAllocationIDR: 30_000_000,
      progress: buildObjectiveProgressFixture(),
      plan,
      creativeBriefs: [],
      escalations: [],
      adFindings: findings,
    });
    expect(result.ok && result.value.weeklyRecommendation).toContain(Branch.CINERE);
    expect(result.ok && result.value.weeklyRecommendation).toContain(Branch.BANDUNG);
  });

  it("weeklyRecommendation falls back to a generic message when there's no clear best/worst branch", () => {
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [],
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
    expect(result.ok && result.value.weeklyRecommendation).toContain("Pantau terus");
  });

  it("computes daysOfBudgetRemaining from daysRemaining when burnRate is 0", () => {
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [],
        generatedAt: now,
      }),
    );
    const result = DailyDigestBuilder.build({
      tenantId: "dss-motor",
      date: now,
      targetHotLeads: 50,
      budgetAllocationIDR: 30_000_000,
      progress: buildObjectiveProgressFixture({ budgetBurnRateIDR: 0, daysRemaining: 15 }),
      plan,
      creativeBriefs: [],
      escalations: [],
      adFindings: [],
    });
    expect(result.ok && result.value.daysOfBudgetRemaining).toBe(15);
  });

  it("handles a zero budgetAllocationIDR without dividing by zero", () => {
    const plan = unwrap(
      ExecutionPlan.create({
        id: ExecutionPlanId.generate(),
        tenantId: "dss-motor",
        decisions: [],
        generatedAt: now,
      }),
    );
    const result = DailyDigestBuilder.build({
      tenantId: "dss-motor",
      date: now,
      targetHotLeads: 50,
      budgetAllocationIDR: 0,
      progress: buildObjectiveProgressFixture(),
      plan,
      creativeBriefs: [],
      escalations: [],
      adFindings: [],
    });
    expect(result.ok && result.value.budgetSpentPercentage).toBe(0);
  });
});
