import { describe, expect, it } from "vitest";

import { compareAssessments, type AssessmentComparisonInput } from "./assessment-comparison.js";
import type { CampaignHealth, HealthDimension } from "./campaign-health.js";
import type { SamanthaDecision } from "./decision.js";
import type { CampaignDiagnosis } from "./diagnosis.js";

function dim(status: HealthDimension["status"]): HealthDimension {
  return status === "UNKNOWN"
    ? { status, confidence: 0, issues: ["no data"] }
    : { status, score: 80, confidence: 0.8, issues: status === "HEALTHY" ? [] : ["issue"] };
}

function health(overrides: Partial<CampaignHealth> = {}): CampaignHealth {
  return {
    delivery: dim("HEALTHY"),
    costEfficiency: dim("HEALTHY"),
    creative: dim("HEALTHY"),
    audience: dim("UNKNOWN"),
    conversion: dim("HEALTHY"),
    tracking: dim("UNKNOWN"),
    leadQuality: dim("UNKNOWN"),
    overallStatus: "HEALTHY",
    ...overrides,
  };
}

function diagnosis(overrides: Partial<CampaignDiagnosis> = {}): CampaignDiagnosis {
  return {
    confidence: 0,
    impact: "UNKNOWN",
    evidence: [],
    contributingFactors: [],
    recommendedFocus: [],
    ...overrides,
  };
}

function decision(overrides: Partial<SamanthaDecision> = {}): SamanthaDecision {
  return {
    decision: "NO_ACTION",
    confidence: 1,
    impact: "LOW",
    reason: "reason",
    riskOfDoingNothing: "none",
    expectedOutcome: "stable",
    monitoringPlan: { reviewAfterHours: 72, successConditions: [], rollbackConditions: [] },
    ...overrides,
  };
}

function baseInput(overrides: Partial<AssessmentComparisonInput> = {}): AssessmentComparisonInput {
  return {
    previousHealth: health(),
    currentHealth: health(),
    previousDiagnosis: diagnosis(),
    currentDiagnosis: diagnosis(),
    previousDecision: decision(),
    currentDecision: decision(),
    ...overrides,
  };
}

describe("compareAssessments", () => {
  describe("dimension trends", () => {
    it("IMPROVED — moved toward HEALTHY", () => {
      const result = compareAssessments(
        baseInput({
          previousHealth: health({ costEfficiency: dim("WARNING") }),
          currentHealth: health({ costEfficiency: dim("HEALTHY") }),
        }),
      );
      expect(result.dimensionTrends.costEfficiency).toBe("IMPROVED");
    });

    it("WORSENED — moved toward CRITICAL", () => {
      const result = compareAssessments(
        baseInput({
          previousHealth: health({ costEfficiency: dim("HEALTHY") }),
          currentHealth: health({ costEfficiency: dim("CRITICAL") }),
        }),
      );
      expect(result.dimensionTrends.costEfficiency).toBe("WORSENED");
    });

    it("UNCHANGED — same real rank both times", () => {
      const result = compareAssessments(
        baseInput({
          previousHealth: health({ costEfficiency: dim("WATCH") }),
          currentHealth: health({ costEfficiency: dim("WATCH") }),
        }),
      );
      expect(result.dimensionTrends.costEfficiency).toBe("UNCHANGED");
    });

    it("UNCHANGED — both UNKNOWN", () => {
      const result = compareAssessments(baseInput());
      expect(result.dimensionTrends.audience).toBe("UNCHANGED");
    });

    it("NEWLY_KNOWN — previous UNKNOWN, current real (regardless of how good/bad)", () => {
      const result = compareAssessments(
        baseInput({
          previousHealth: health({ audience: dim("UNKNOWN") }),
          currentHealth: health({ audience: dim("CRITICAL") }),
        }),
      );
      expect(result.dimensionTrends.audience).toBe("NEWLY_KNOWN");
    });

    it("NEWLY_UNKNOWN — previous real, current UNKNOWN (lost data)", () => {
      const result = compareAssessments(
        baseInput({
          previousHealth: health({ delivery: dim("HEALTHY") }),
          currentHealth: health({ delivery: dim("UNKNOWN") }),
        }),
      );
      expect(result.dimensionTrends.delivery).toBe("NEWLY_UNKNOWN");
    });
  });

  describe("overallStatusTrend", () => {
    it("reuses the same trend comparator on overallStatus", () => {
      const result = compareAssessments(
        baseInput({
          previousHealth: health({ overallStatus: "WARNING" }),
          currentHealth: health({ overallStatus: "HEALTHY" }),
        }),
      );
      expect(result.overallStatusTrend).toBe("IMPROVED");
    });
  });

  describe("rootCauseTrend", () => {
    it("NONE_EITHER_TIME", () => {
      const result = compareAssessments(baseInput());
      expect(result.rootCauseTrend).toBe("NONE_EITHER_TIME");
    });

    it("RESOLVED — previous had one, current does not", () => {
      const result = compareAssessments(
        baseInput({
          previousDiagnosis: diagnosis({ rootCause: "CPL_SPIKE" }),
          currentDiagnosis: diagnosis({ rootCause: undefined }),
        }),
      );
      expect(result.rootCauseTrend).toBe("RESOLVED");
    });

    it("NEW — previous had none, current has one", () => {
      const result = compareAssessments(
        baseInput({
          previousDiagnosis: diagnosis({ rootCause: undefined }),
          currentDiagnosis: diagnosis({ rootCause: "CTR_DROP" }),
        }),
      );
      expect(result.rootCauseTrend).toBe("NEW");
    });

    it("PERSISTED — both defined and equal", () => {
      const result = compareAssessments(
        baseInput({
          previousDiagnosis: diagnosis({ rootCause: "CPL_SPIKE" }),
          currentDiagnosis: diagnosis({ rootCause: "CPL_SPIKE" }),
        }),
      );
      expect(result.rootCauseTrend).toBe("PERSISTED");
    });

    it("CHANGED — both defined, different", () => {
      const result = compareAssessments(
        baseInput({
          previousDiagnosis: diagnosis({ rootCause: "CPL_SPIKE" }),
          currentDiagnosis: diagnosis({ rootCause: "CTR_DROP" }),
        }),
      );
      expect(result.rootCauseTrend).toBe("CHANGED");
    });
  });

  describe("decisionChanged", () => {
    it("true when decision.decision differs", () => {
      const result = compareAssessments(
        baseInput({
          previousDecision: decision({ decision: "NO_ACTION" }),
          currentDecision: decision({ decision: "MONITOR" }),
        }),
      );
      expect(result.decisionChanged).toBe(true);
    });

    it("false when decision.decision is the same", () => {
      const result = compareAssessments(baseInput());
      expect(result.decisionChanged).toBe(false);
    });
  });

  describe("summary", () => {
    it("a full-improvement case names the resolved root cause first", () => {
      const result = compareAssessments(
        baseInput({
          previousHealth: health({ overallStatus: "CRITICAL", costEfficiency: dim("CRITICAL") }),
          currentHealth: health({ overallStatus: "HEALTHY", costEfficiency: dim("HEALTHY") }),
          previousDiagnosis: diagnosis({ rootCause: "CPL_SPIKE" }),
          currentDiagnosis: diagnosis({ rootCause: undefined }),
        }),
      );
      expect(result.summary).toContain("CPL_SPIKE");
      expect(result.summary.toLowerCase()).toContain("membaik");
    });

    it("a full-regression case reports the worsened overall status", () => {
      const result = compareAssessments(
        baseInput({
          previousHealth: health({ overallStatus: "HEALTHY" }),
          currentHealth: health({ overallStatus: "CRITICAL" }),
          previousDiagnosis: diagnosis({ rootCause: undefined }),
          currentDiagnosis: diagnosis({ rootCause: "SPEND_WITHOUT_RESULT" }),
        }),
      );
      expect(result.summary.toLowerCase()).toContain("memburuk");
    });

    it("a completely-unchanged case gives an honest 'no meaningful change' sentence, not a fabricated one", () => {
      const result = compareAssessments(baseInput());
      expect(result.summary).toBe("Tidak ada perubahan berarti dibanding penilaian sebelumnya.");
    });

    it("reports decisionChanged alone when nothing else moved", () => {
      const result = compareAssessments(
        baseInput({
          previousDecision: decision({ decision: "NO_ACTION" }),
          currentDecision: decision({ decision: "MONITOR" }),
        }),
      );
      expect(result.summary).toContain("Rekomendasi tindakan berubah");
    });

    it("names a single worsened dimension when overallStatus itself did not move", () => {
      const result = compareAssessments(
        baseInput({
          previousHealth: health({ overallStatus: "WARNING", costEfficiency: dim("HEALTHY") }),
          currentHealth: health({ overallStatus: "WARNING", costEfficiency: dim("CRITICAL") }),
        }),
      );
      expect(result.summary).toContain("efisiensi biaya");
      expect(result.summary.toLowerCase()).toContain("memburuk");
    });
  });
});
