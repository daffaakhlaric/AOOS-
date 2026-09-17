import { Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import type {
  SamanthaSignal,
  SamanthaSignalType,
} from "../../metric-snapshot/domain/signal-engine.js";

import type { CampaignHealth, HealthDimension } from "./campaign-health.js";
import { decideNextAction } from "./decision.js";
import type { CampaignDiagnosis, DiagnosisImpact } from "./diagnosis.js";

function healthyDimension(): HealthDimension {
  return { status: "HEALTHY", score: 100, confidence: 1, issues: [] };
}

function unknownDimension(issue = "unknown"): HealthDimension {
  return { status: "UNKNOWN", confidence: 0, issues: [issue] };
}

function warningDimension(): HealthDimension {
  return { status: "WARNING", score: 30, confidence: 0.8, issues: ["mahal"] };
}

function makeHealth(overrides: Partial<CampaignHealth> = {}): CampaignHealth {
  return {
    delivery: healthyDimension(),
    costEfficiency: healthyDimension(),
    creative: healthyDimension(),
    audience: unknownDimension(),
    conversion: healthyDimension(),
    tracking: unknownDimension(),
    leadQuality: unknownDimension(),
    overallStatus: "HEALTHY",
    ...overrides,
  };
}

function makeAllUnknownHealth(): CampaignHealth {
  return {
    delivery: unknownDimension(),
    costEfficiency: unknownDimension(),
    creative: unknownDimension(),
    audience: unknownDimension(),
    conversion: unknownDimension(),
    tracking: unknownDimension(),
    leadQuality: unknownDimension(),
    overallStatus: "UNKNOWN",
  };
}

function makeSignal(overrides: Partial<SamanthaSignal> = {}): SamanthaSignal {
  return {
    type: "CTR_DROP",
    severity: "MEDIUM",
    confidence: 0.8,
    reasoning: "CTR turun signifikan.",
    ...overrides,
  };
}

function makeDiagnosis(overrides: Partial<CampaignDiagnosis> = {}): CampaignDiagnosis {
  return {
    confidence: 0,
    impact: "UNKNOWN",
    evidence: [],
    contributingFactors: [],
    recommendedFocus: [],
    ...overrides,
  };
}

function makeRootCauseDiagnosis(
  rootCause: SamanthaSignalType,
  impact: DiagnosisImpact,
  confidence = 0.75,
): CampaignDiagnosis {
  return makeDiagnosis({
    rootCause,
    confidence,
    impact,
    evidence: [makeSignal({ type: rootCause })],
  });
}

describe("decideNextAction", () => {
  it("returns MONITOR with confidence 0 / impact UNKNOWN when overallStatus is UNKNOWN", () => {
    const health = makeAllUnknownHealth();
    const diagnosis = makeDiagnosis();
    const decision = decideNextAction(health, diagnosis);

    expect(decision.decision).toBe("MONITOR");
    expect(decision.confidence).toBe(0);
    expect(decision.impact).toBe("UNKNOWN");
    expect(decision.primaryDiagnosis).toBeUndefined();
  });

  it("MONITOR (no usable data) has an empty rollbackConditions inside monitoringPlan", () => {
    const decision = decideNextAction(makeAllUnknownHealth(), makeDiagnosis());
    expect(decision.monitoringPlan.rollbackConditions).toEqual([]);
    expect(decision.monitoringPlan.successConditions.length).toBeGreaterThan(0);
    expect(decision.monitoringPlan.reviewAfterHours).toBe(72);
  });

  it("returns NO_ACTION when rootCause is undefined and overallStatus is HEALTHY", () => {
    const decision = decideNextAction(makeHealth(), makeDiagnosis());

    expect(decision.decision).toBe("NO_ACTION");
    expect(decision.primaryDiagnosis).toBeUndefined();
    expect(decision.riskOfDoingNothing).toBe("Tidak ada risiko signifikan.");
    expect(decision.monitoringPlan.rollbackConditions).toEqual([]);
  });

  it("returns MONITOR when rootCause is undefined but overallStatus is not HEALTHY (data-sufficiency-only concern)", () => {
    const health = makeHealth({ costEfficiency: warningDimension(), overallStatus: "WARNING" });
    const decision = decideNextAction(health, makeDiagnosis());

    expect(decision.decision).toBe("MONITOR");
    expect(decision.reason).toContain("WARNING");
    expect(decision.monitoringPlan.rollbackConditions).toEqual([]);
  });

  it("SPEND_WITHOUT_RESULT rootCause maps to Verdict.PAUSE", () => {
    const health = makeHealth({ overallStatus: "CRITICAL" });
    const diagnosis = makeRootCauseDiagnosis("SPEND_WITHOUT_RESULT", "CRITICAL", 0.9);
    const decision = decideNextAction(health, diagnosis);

    expect(decision.decision).toBe(Verdict.PAUSE);
    expect(decision.primaryDiagnosis).toBe("SPEND_WITHOUT_RESULT");
    expect(decision.confidence).toBe(0.9);
    expect(decision.impact).toBe("CRITICAL");
    expect(decision.monitoringPlan.reviewAfterHours).toBe(24);
    expect(decision.monitoringPlan.rollbackConditions.length).toBeGreaterThan(0);
  });

  it("CREATIVE_FATIGUE rootCause maps to REQUEST_KAI_CREATIVE", () => {
    const health = makeHealth({ creative: warningDimension(), overallStatus: "WARNING" });
    const diagnosis = makeRootCauseDiagnosis("CREATIVE_FATIGUE", "MEDIUM");
    const decision = decideNextAction(health, diagnosis);

    expect(decision.decision).toBe("REQUEST_KAI_CREATIVE");
    expect(decision.reason).toContain("CREATIVE_FATIGUE");
    expect(decision.monitoringPlan.reviewAfterHours).toBe(72);
  });

  it("FREQUENCY_RISE rootCause maps to Verdict.REFRESH", () => {
    const health = makeHealth({ overallStatus: "WATCH" });
    const diagnosis = makeRootCauseDiagnosis("FREQUENCY_RISE", "HIGH");
    const decision = decideNextAction(health, diagnosis);

    expect(decision.decision).toBe(Verdict.REFRESH);
    expect(decision.monitoringPlan.reviewAfterHours).toBe(48);
  });

  it("CTR_DROP rootCause maps to Verdict.REVIEW with a non-overconfident reason", () => {
    const health = makeHealth({ conversion: warningDimension(), overallStatus: "WARNING" });
    const diagnosis = makeRootCauseDiagnosis("CTR_DROP", "MEDIUM");
    const decision = decideNextAction(health, diagnosis);

    expect(decision.decision).toBe(Verdict.REVIEW);
    expect(decision.reason).toContain("CTR_DROP");
    expect(decision.reason.toLowerCase()).toContain("targeting");
  });

  it("CPL_SPIKE rootCause maps to Verdict.REVIEW with a non-overconfident reason", () => {
    const health = makeHealth({ costEfficiency: warningDimension(), overallStatus: "WARNING" });
    const diagnosis = makeRootCauseDiagnosis("CPL_SPIKE", "MEDIUM");
    const decision = decideNextAction(health, diagnosis);

    expect(decision.decision).toBe(Verdict.REVIEW);
    expect(decision.reason).toContain("CPL_SPIKE");
  });

  it("CTR_IMPROVEMENT rootCause maps to Verdict.SCALE", () => {
    const health = makeHealth();
    const diagnosis = makeRootCauseDiagnosis("CTR_IMPROVEMENT", "LOW", 0.6);
    const decision = decideNextAction(health, diagnosis);

    expect(decision.decision).toBe(Verdict.SCALE);
    expect(decision.monitoringPlan.reviewAfterHours).toBe(72);
  });

  it("CPL_IMPROVEMENT rootCause maps to Verdict.SCALE", () => {
    const health = makeHealth();
    const diagnosis = makeRootCauseDiagnosis("CPL_IMPROVEMENT", "LOW", 0.6);
    const decision = decideNextAction(health, diagnosis);

    expect(decision.decision).toBe(Verdict.SCALE);
  });

  it("falls back to REVIEW (never NO_ACTION) for an unmapped-but-real rootCause type", () => {
    const health = makeHealth({ overallStatus: "WARNING" });
    // INSUFFICIENT_DATA is a real SamanthaSignalType with no entry in ROOT_CAUSE_DECISIONS —
    // diagnoseCampaign never actually sets this as rootCause, but decideNextAction must still
    // handle any future/unmapped real signal type safely rather than silently falling through.
    const diagnosis = makeRootCauseDiagnosis("INSUFFICIENT_DATA" as SamanthaSignalType, "MEDIUM");
    const decision = decideNextAction(health, diagnosis);

    expect(decision.decision).toBe(Verdict.REVIEW);
    expect(decision.decision).not.toBe("NO_ACTION");
  });

  it("every rootCause-based decision echoes diagnosis.confidence and diagnosis.impact", () => {
    const health = makeHealth({ overallStatus: "CRITICAL" });
    const diagnosis = makeRootCauseDiagnosis("SPEND_WITHOUT_RESULT", "CRITICAL", 0.42);
    const decision = decideNextAction(health, diagnosis);

    expect(decision.confidence).toBe(0.42);
    expect(decision.impact).toBe("CRITICAL");
  });

  it("expectedOutcome uses hedged language, never a guarantee, across representative branches", () => {
    const hedgeWords = ["berpotensi", "diperkirakan"];
    const cases: Array<{ health: CampaignHealth; diagnosis: CampaignDiagnosis }> = [
      { health: makeAllUnknownHealth(), diagnosis: makeDiagnosis() },
      { health: makeHealth(), diagnosis: makeDiagnosis() },
      {
        health: makeHealth({ overallStatus: "CRITICAL" }),
        diagnosis: makeRootCauseDiagnosis("SPEND_WITHOUT_RESULT", "CRITICAL"),
      },
      {
        health: makeHealth({ overallStatus: "WATCH" }),
        diagnosis: makeRootCauseDiagnosis("FREQUENCY_RISE", "HIGH"),
      },
    ];

    for (const { health, diagnosis } of cases) {
      const decision = decideNextAction(health, diagnosis);
      const hasHedge = hedgeWords.some((word) => decision.expectedOutcome.includes(word));
      expect(hasHedge).toBe(true);
    }
  });
});
