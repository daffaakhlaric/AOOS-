import { describe, expect, it } from "vitest";

import type { SamanthaSignal } from "../../metric-snapshot/domain/signal-engine.js";

import type { CampaignHealth, HealthDimension } from "./campaign-health.js";
import { diagnoseCampaign } from "./diagnosis.js";

function healthyDimension(): HealthDimension {
  return { status: "HEALTHY", score: 100, confidence: 1, issues: [] };
}

function unknownDimension(issue = "unknown"): HealthDimension {
  return { status: "UNKNOWN", confidence: 0, issues: [issue] };
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

function makeSignal(overrides: Partial<SamanthaSignal> = {}): SamanthaSignal {
  return {
    type: "CTR_DROP",
    severity: "MEDIUM",
    confidence: 0.8,
    reasoning: "CTR turun signifikan.",
    ...overrides,
  };
}

describe("diagnoseCampaign", () => {
  it("returns no rootCause when signals is empty", () => {
    const diagnosis = diagnoseCampaign(makeHealth(), []);
    expect(diagnosis.rootCause).toBeUndefined();
    expect(diagnosis.confidence).toBe(0);
    expect(diagnosis.impact).toBe("UNKNOWN");
    expect(diagnosis.evidence).toEqual([]);
    expect(diagnosis.contributingFactors).toEqual([]);
  });

  it("returns no rootCause when signals contains only INSUFFICIENT_DATA", () => {
    const diagnosis = diagnoseCampaign(makeHealth(), [
      makeSignal({ type: "INSUFFICIENT_DATA", severity: "INFO", reasoning: "not enough data" }),
    ]);
    expect(diagnosis.rootCause).toBeUndefined();
    expect(diagnosis.confidence).toBe(0);
    expect(diagnosis.impact).toBe("UNKNOWN");
    expect(diagnosis.evidence).toEqual([]);
  });

  it("picks the worst-severity real signal as rootCause, excluding INSUFFICIENT_DATA", () => {
    const critical = makeSignal({
      type: "SPEND_WITHOUT_RESULT",
      severity: "HIGH",
      confidence: 0.9,
    });
    const info = makeSignal({ type: "CPL_IMPROVEMENT", severity: "INFO", confidence: 0.5 });
    const insufficient = makeSignal({
      type: "INSUFFICIENT_DATA",
      severity: "INFO",
      confidence: 0.2,
    });
    const diagnosis = diagnoseCampaign(makeHealth(), [info, insufficient, critical]);
    expect(diagnosis.rootCause).toBe("SPEND_WITHOUT_RESULT");
    expect(diagnosis.confidence).toBe(0.9);
    expect(diagnosis.impact).toBe("HIGH");
  });

  it("orders evidence worst-severity first and excludes INSUFFICIENT_DATA", () => {
    const low = makeSignal({ type: "FREQUENCY_RISE", severity: "LOW" });
    const critical = makeSignal({ type: "CTR_DROP", severity: "HIGH" });
    const medium = makeSignal({ type: "CPL_SPIKE", severity: "MEDIUM" });
    const insufficient = makeSignal({ type: "INSUFFICIENT_DATA", severity: "INFO" });
    const diagnosis = diagnoseCampaign(makeHealth(), [low, insufficient, critical, medium]);
    expect(diagnosis.evidence.map((s) => s.type)).toEqual([
      "CTR_DROP",
      "CPL_SPIKE",
      "FREQUENCY_RISE",
    ]);
  });

  it("maps INFO severity rootCause to LOW impact, never fabricating urgency", () => {
    const diagnosis = diagnoseCampaign(makeHealth(), [
      makeSignal({ type: "CTR_IMPROVEMENT", severity: "INFO", confidence: 0.7 }),
    ]);
    expect(diagnosis.rootCause).toBe("CTR_IMPROVEMENT");
    expect(diagnosis.impact).toBe("LOW");
  });

  it("produces one Indonesian contributingFactors line per non-root signal", () => {
    const critical = makeSignal({
      type: "CTR_DROP",
      severity: "HIGH",
      reasoning: "CTR turun 30%.",
    });
    const medium = makeSignal({
      type: "CPL_SPIKE",
      severity: "MEDIUM",
      reasoning: "CPL naik 20%.",
    });
    const diagnosis = diagnoseCampaign(makeHealth(), [critical, medium]);
    expect(diagnosis.contributingFactors).toHaveLength(1);
    expect(diagnosis.contributingFactors[0]).toContain("CPL_SPIKE");
    expect(diagnosis.contributingFactors[0]).toContain("CPL naik 20%.");
  });

  it("recommendedFocus lists only dimensions that are neither HEALTHY nor UNKNOWN", () => {
    const health = makeHealth({
      costEfficiency: { status: "WARNING", score: 30, confidence: 0.8, issues: ["mahal"] },
      creative: { status: "CRITICAL", score: 10, confidence: 0.9, issues: ["fatigue"] },
    });
    const diagnosis = diagnoseCampaign(health, []);
    expect(diagnosis.recommendedFocus).toEqual(["costEfficiency", "creative"]);
  });

  it("recommendedFocus is computed even when there is no rootCause", () => {
    const health = makeHealth({
      delivery: { status: "WATCH", score: 40, confidence: 0.4, issues: ["low sufficiency"] },
    });
    const diagnosis = diagnoseCampaign(health, []);
    expect(diagnosis.rootCause).toBeUndefined();
    expect(diagnosis.recommendedFocus).toEqual(["delivery"]);
  });

  it("recommendedFocus is empty when every dimension is HEALTHY or UNKNOWN", () => {
    const diagnosis = diagnoseCampaign(makeHealth(), []);
    expect(diagnosis.recommendedFocus).toEqual([]);
  });
});
