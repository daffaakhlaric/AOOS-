import { describe, expect, it } from "vitest";

import type {
  StressTestCopyDimensionStatus,
  StressTestCopyEvaluationResult,
  StressTestFactCheckResult,
  StressTestPersonaAttempt,
} from "./stress-test-run.js";
import { computeStressTestScoring } from "./stress-test-scoring.js";

const OK_COPY: StressTestCopyEvaluationResult = {
  ok: true,
  hookClarity: { status: "STRONG", reasoning: "Judul menarik." },
  offerStrength: { status: "ADEQUATE", reasoning: "Cukup." },
  ctaSpecificity: { status: "WEAK", reasoning: "Tidak ada CTA jelas." },
  internalConsistency: { status: "STRONG", reasoning: "Konsisten." },
  summary: "Ringkasan.",
};

const FAILED_COPY: StressTestCopyEvaluationResult = {
  ok: false,
  failureReason: "PROVIDER_ERROR",
};

const NOT_APPLICABLE_FACT: StressTestFactCheckResult = {
  status: "NOT_APPLICABLE",
  note: "Tidak dapat diverifikasi — belum ada Listing Knowledge untuk listing ini.",
  findings: [],
};

const CHECKED_FACT_ALL_SUPPORTED: StressTestFactCheckResult = {
  status: "CHECKED",
  note: "Diperiksa.",
  findings: [{ claim: "Dekat stasiun", status: "SUPPORTED", reasoning: "Cocok." }],
};

function okPersona(
  id: string,
  severities: readonly ("HIGH" | "MEDIUM" | "LOW")[],
): StressTestPersonaAttempt {
  return {
    personaId: id,
    personaLabel: id,
    ok: true,
    critique: {
      simulated: true,
      attracts: ["a"],
      confusions: [],
      objections: severities.map((severity) => ({ objection: `objection-${severity}`, severity })),
      intentDrivers: [],
      narrativeReaction: "reaction",
    },
  };
}

function failedPersona(id: string): StressTestPersonaAttempt {
  return { personaId: id, personaLabel: id, ok: false, failureReason: "PROVIDER_ERROR" };
}

describe("computeStressTestScoring", () => {
  it("computes Hook/Offer/CTA from a real, successful copy evaluation and Objection Handling from real successful persona simulations", () => {
    const output = computeStressTestScoring(
      [okPersona("PRICE_SENSITIVE", ["LOW"])],
      OK_COPY,
      NOT_APPLICABLE_FACT,
    );
    const dims = new Map(output.dimensionScores.map((d) => [d.dimension, d.score]));
    expect(dims.get("HOOK")).toBe(90);
    expect(dims.get("OFFER")).toBe(65);
    expect(dims.get("CTA")).toBe(35);
    expect(dims.get("OBJECTION_HANDLING")).toBe(95); // 100 - LOW(5)
    expect(output.overallScore).toBe(Math.round((90 + 65 + 35 + 95) / 4));
  });

  it("never produces a dimension score for a failed evaluator", () => {
    const output = computeStressTestScoring(
      [failedPersona("PRICE_SENSITIVE")],
      FAILED_COPY,
      NOT_APPLICABLE_FACT,
    );
    expect(output.dimensionScores).toHaveLength(0);
    expect(output.overallScore).toBeNull();
    expect(output.scoreBucket).toBeNull();
    expect(output.gaps.length).toBeGreaterThan(0);
  });

  it("buckets overall score using the disclosed thresholds", () => {
    const readyToTest = computeStressTestScoring(
      [okPersona("PRICE_SENSITIVE", [])],
      OK_COPY_FOR_BUCKET(90),
      NOT_APPLICABLE_FACT,
    );
    expect(readyToTest.scoreBucket).toBe("READY_TO_TEST");

    const majorIssues = computeStressTestScoring(
      [okPersona("PRICE_SENSITIVE", ["HIGH", "HIGH", "HIGH"])],
      OK_COPY_FOR_BUCKET(30),
      NOT_APPLICABLE_FACT,
    );
    expect(majorIssues.scoreBucket).toBe("MAJOR_ISSUES");
  });

  it("reduces confidence when a Fact Validator is NOT_APPLICABLE (no real Listing Knowledge to ground against)", () => {
    const withKnowledge = computeStressTestScoring(
      [okPersona("PRICE_SENSITIVE", [])],
      OK_COPY,
      CHECKED_FACT_ALL_SUPPORTED,
    );
    const withoutKnowledge = computeStressTestScoring(
      [okPersona("PRICE_SENSITIVE", [])],
      OK_COPY,
      NOT_APPLICABLE_FACT,
    );
    expect(withoutKnowledge.confidence).toBeLessThan(withKnowledge.confidence);
  });

  it("reduces confidence proportionally to how many evaluators actually succeeded", () => {
    const allSucceeded = computeStressTestScoring(
      [okPersona("PRICE_SENSITIVE", []), okPersona("HIGH_INTENT", [])],
      OK_COPY,
      NOT_APPLICABLE_FACT,
    );
    const oneFailed = computeStressTestScoring(
      [okPersona("PRICE_SENSITIVE", []), failedPersona("HIGH_INTENT")],
      OK_COPY,
      NOT_APPLICABLE_FACT,
    );
    expect(oneFailed.confidence).toBeLessThan(allSucceeded.confidence);
    expect(oneFailed.evaluatorsSucceeded).toBeLessThan(oneFailed.evaluatorsAttempted);
  });

  it("primaryRecommendation is a specific sentence citing the real evaluator finding that drove the lowest dimension, never a generic one", () => {
    const output = computeStressTestScoring(
      [okPersona("PRICE_SENSITIVE", [])],
      OK_COPY,
      NOT_APPLICABLE_FACT,
    );
    // CTA (35) is the lowest real dimension in OK_COPY — the recommendation should reference it.
    expect(output.primaryRecommendation).toContain("Tidak ada CTA jelas");
  });

  it("primaryRecommendation prioritizes a real CONFLICTING_CLAIM finding over dimension scores", () => {
    const conflictingFact: StressTestFactCheckResult = {
      status: "CHECKED",
      note: "Diperiksa.",
      findings: [
        {
          claim: "Harga Rp 1 miliar",
          status: "CONFLICTING_CLAIM",
          reasoning: "Listing Knowledge menyebut harga Rp 1.5 miliar.",
        },
      ],
    };
    const output = computeStressTestScoring(
      [okPersona("PRICE_SENSITIVE", [])],
      OK_COPY,
      conflictingFact,
    );
    expect(output.primaryRecommendation).toContain("BERTENTANGAN");
  });

  describe("Objection Resolution accounting", () => {
    const personas = [okPersona("A", ["MEDIUM"]), okPersona("B", [])];
    it("counts the resolution evaluator (+1 attempted, +1 succeeded) only when it was called and ASSESSED", () => {
      const out = computeStressTestScoring(personas, OK_COPY, CHECKED_FACT_ALL_SUPPORTED, {
        status: "ASSESSED",
        simulated: true,
        note: "n",
        items: [],
      });
      expect(out.evaluatorsAttempted).toBe(4);
      expect(out.evaluatorsSucceeded).toBe(4);
      expect(out.confidence).toBe(100);
    });
    it("a FAILED resolution call lowers confidence and adds a gap; SKIPPED is not counted", () => {
      const failed = computeStressTestScoring(personas, OK_COPY, CHECKED_FACT_ALL_SUPPORTED, {
        status: "FAILED",
        simulated: true,
        note: "PROVIDER_ERROR: x",
        items: [],
      });
      expect(failed.evaluatorsAttempted).toBe(4);
      expect(failed.evaluatorsSucceeded).toBe(3);
      expect(failed.confidence).toBe(75);
      expect(failed.gaps.some((g) => g.includes("Objection Resolution"))).toBe(true);
      const skipped = computeStressTestScoring(personas, OK_COPY, CHECKED_FACT_ALL_SUPPORTED, {
        status: "SKIPPED",
        simulated: true,
        note: "n",
        items: [],
      });
      expect(skipped.evaluatorsAttempted).toBe(3);
      expect(skipped.confidence).toBe(100);
      // Legacy call signature (no resolution argument) is unchanged.
      expect(
        computeStressTestScoring(personas, OK_COPY, CHECKED_FACT_ALL_SUPPORTED).evaluatorsAttempted,
      ).toBe(3);
    });
    it("never adds a dimension score for objection resolution", () => {
      const out = computeStressTestScoring(personas, OK_COPY, CHECKED_FACT_ALL_SUPPORTED, {
        status: "ASSESSED",
        simulated: true,
        note: "n",
        items: [],
      });
      expect(out.dimensionScores.map((d) => d.dimension).sort()).toEqual([
        "CTA",
        "HOOK",
        "OBJECTION_HANDLING",
        "OFFER",
      ]);
    });
  });
});

function OK_COPY_FOR_BUCKET(score: number): StressTestCopyEvaluationResult {
  const status: StressTestCopyDimensionStatus =
    score >= 85 ? "STRONG" : score >= 65 ? "ADEQUATE" : "WEAK";
  return {
    ok: true,
    hookClarity: { status, reasoning: "r" },
    offerStrength: { status, reasoning: "r" },
    ctaSpecificity: { status, reasoning: "r" },
    internalConsistency: { status, reasoning: "r" },
    summary: "s",
  };
}
