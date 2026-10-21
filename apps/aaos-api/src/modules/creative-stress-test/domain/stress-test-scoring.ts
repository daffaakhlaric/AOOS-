import type {
  StressTestCopyDimensionStatus,
  StressTestCopyEvaluationResult,
  StressTestDimensionKey,
  StressTestDimensionScore,
  StressTestFactCheckResult,
  StressTestObjectionResolutionResult,
  StressTestObjectionSeverity,
  StressTestPersonaAttempt,
  StressTestScoreBucket,
} from "./stress-test-run.js";

/**
 * Creative Stress Test, Second Boundary — scoring aggregation. Combines the real evaluator outputs
 * (persona simulations + copy evaluation; the fact-checker never produces a dimension score, see
 * below) into one overall 0-100 score, a disclosed status bucket, per-dimension scores, a real
 * `confidence`, and a specific primary recommendation. Pure function, no I/O — every input here is
 * an already-real evaluator result `CreativeStressTestService.execute` collected.
 *
 * DISCLOSED, SELF-CHOSEN MAPPINGS (never claimed as backend-config-driven or externally
 * calibrated — same honesty pattern this session's other tabs already used for similar disclosed
 * thresholds):
 * - Copy dimension status -> score: STRONG=90, ADEQUATE=65, WEAK=35.
 * - Objection severity -> score penalty (starting from 100, per persona, averaged across personas):
 *   HIGH=-25, MEDIUM=-12, LOW=-5, floored at 0.
 * - Overall score = the mean of whichever dimension scores are actually present — NEVER an
 *   assumed/defaulted score for a dimension with no real evaluator behind it.
 * - Score bucket: 85-100 READY_TO_TEST / 70-84 MINOR_REVISION / 50-69 NEEDS_REVISION / <50
 *   MAJOR_ISSUES.
 * - Evaluators counted in attempted/succeeded: each persona simulation call, the copy evaluator,
 *   and — only when it was actually CALLED (status ASSESSED or FAILED, never SKIPPED) — the
 *   Objection Resolution evaluator (+1 attempted, +1 succeeded when ASSESSED). The Fact Validator
 *   stays outside this ratio (it has its own NOT_APPLICABLE penalty below), unchanged. The
 *   resolution evaluator never contributes a dimension score.
 * - Confidence: 100 * (evaluators succeeded / evaluators attempted), then a flat -15 point penalty
 *   when the Fact Validator was `NOT_APPLICABLE` (no real Listing Knowledge existed to ground
 *   against) — a real, disclosed "we could not fact-check this" penalty, not a hidden gap.
 *
 * "Objection Handling" and "Hook"/"Offer"/"CTA" are the ONLY 4 dimensions this boundary ever
 * reports — see this module's own PROMPT doc ("never build a dimension score with no real
 * evaluator behind it"). The Fact Validator's findings are surfaced separately in
 * `StressTestEvaluatedResult.factCheck`, never blended into a 5th dimension score.
 */

const COPY_DIMENSION_SCORE: Record<StressTestCopyDimensionStatus, number> = {
  STRONG: 90,
  ADEQUATE: 65,
  WEAK: 35,
};

const OBJECTION_SEVERITY_PENALTY: Record<StressTestObjectionSeverity, number> = {
  HIGH: 25,
  MEDIUM: 12,
  LOW: 5,
};

const SCORE_BUCKET_THRESHOLDS: readonly {
  readonly min: number;
  readonly bucket: StressTestScoreBucket;
}[] = [
  { min: 85, bucket: "READY_TO_TEST" },
  { min: 70, bucket: "MINOR_REVISION" },
  { min: 50, bucket: "NEEDS_REVISION" },
  { min: 0, bucket: "MAJOR_ISSUES" },
];

const NOT_APPLICABLE_FACT_CHECK_CONFIDENCE_PENALTY = 15;

function scoreBucketFor(overallScore: number): StressTestScoreBucket {
  const match = SCORE_BUCKET_THRESHOLDS.find((t) => overallScore >= t.min);
  return match?.bucket ?? "MAJOR_ISSUES";
}

/** Mean objection-handling score across personas that actually produced a real critique. `undefined` when no persona succeeded. */
function objectionHandlingScore(
  personaAttempts: readonly StressTestPersonaAttempt[],
): number | undefined {
  const succeeded = personaAttempts.filter((p) => p.ok && p.critique !== undefined);
  if (succeeded.length === 0) {
    return undefined;
  }
  const perPersonaScores = succeeded.map((p) => {
    const penalty = (p.critique?.objections ?? []).reduce(
      (sum, o) => sum + OBJECTION_SEVERITY_PENALTY[o.severity],
      0,
    );
    return Math.max(0, 100 - penalty);
  });
  return perPersonaScores.reduce((a, b) => a + b, 0) / perPersonaScores.length;
}

export interface StressTestScoringOutput {
  readonly dimensionScores: readonly StressTestDimensionScore[];
  readonly overallScore: number | null;
  readonly scoreBucket: StressTestScoreBucket | null;
  readonly confidence: number;
  readonly primaryRecommendation: string;
  readonly evaluatorsAttempted: number;
  readonly evaluatorsSucceeded: number;
  readonly gaps: readonly string[];
}

export function computeStressTestScoring(
  personaAttempts: readonly StressTestPersonaAttempt[],
  copyEvaluation: StressTestCopyEvaluationResult,
  factCheck: StressTestFactCheckResult,
  objectionResolution?: StressTestObjectionResolutionResult,
): StressTestScoringOutput {
  const dimensionScores: StressTestDimensionScore[] = [];
  const gaps: string[] = [];

  if (copyEvaluation.ok) {
    if (copyEvaluation.hookClarity !== undefined) {
      dimensionScores.push({
        dimension: "HOOK",
        score: COPY_DIMENSION_SCORE[copyEvaluation.hookClarity.status],
      });
    }
    if (copyEvaluation.offerStrength !== undefined) {
      dimensionScores.push({
        dimension: "OFFER",
        score: COPY_DIMENSION_SCORE[copyEvaluation.offerStrength.status],
      });
    }
    if (copyEvaluation.ctaSpecificity !== undefined) {
      dimensionScores.push({
        dimension: "CTA",
        score: COPY_DIMENSION_SCORE[copyEvaluation.ctaSpecificity.status],
      });
    }
  } else {
    gaps.push(
      `Copy Evaluator gagal dijalankan${copyEvaluation.failureReason !== undefined ? ` (${copyEvaluation.failureReason})` : ""} — dimensi Hook/Offer/CTA tidak memiliki skor nyata pada run ini.`,
    );
  }

  const objectionScore = objectionHandlingScore(personaAttempts);
  if (objectionScore !== undefined) {
    dimensionScores.push({ dimension: "OBJECTION_HANDLING", score: Math.round(objectionScore) });
  } else if (personaAttempts.length > 0) {
    gaps.push(
      "Tidak ada simulasi persona yang berhasil — dimensi Objection Handling tidak memiliki skor nyata pada run ini.",
    );
  }

  const overallScore =
    dimensionScores.length === 0
      ? null
      : Math.round(dimensionScores.reduce((sum, d) => sum + d.score, 0) / dimensionScores.length);
  const scoreBucket = overallScore === null ? null : scoreBucketFor(overallScore);

  const personaSucceeded = personaAttempts.filter((p) => p.ok).length;
  const resolutionAttempted =
    objectionResolution !== undefined && objectionResolution.status !== "SKIPPED";
  const evaluatorsAttempted = personaAttempts.length + 1 + (resolutionAttempted ? 1 : 0); // +1 copy evaluator, +1 objection resolution when called
  const evaluatorsSucceeded =
    personaSucceeded +
    (copyEvaluation.ok ? 1 : 0) +
    (objectionResolution?.status === "ASSESSED" ? 1 : 0);
  if (objectionResolution?.status === "FAILED") {
    gaps.push(
      `Objection Resolution Evaluator gagal dijalankan (${objectionResolution.note}) — status resolusi & dampak keberatan tidak dinilai pada run ini.`,
    );
  }

  let confidence =
    evaluatorsAttempted === 0 ? 0 : Math.round((100 * evaluatorsSucceeded) / evaluatorsAttempted);
  if (factCheck.status === "NOT_APPLICABLE") {
    confidence = Math.max(0, confidence - NOT_APPLICABLE_FACT_CHECK_CONFIDENCE_PENALTY);
    gaps.push(factCheck.note);
  } else if (factCheck.status === "FAILED") {
    gaps.push(`Fact/Claim Validator gagal dijalankan — ${factCheck.note}`);
  } else if (factCheck.findings.some((f) => f.status !== "SUPPORTED")) {
    const flagged = factCheck.findings.filter((f) => f.status !== "SUPPORTED").length;
    gaps.push(
      `${String(flagged)} klaim pada creative ini ditandai UNSUPPORTED_CLAIM/CONFLICTING_CLAIM oleh Fact Validator — lihat rincian di factCheck.findings.`,
    );
  }

  const primaryRecommendation = buildPrimaryRecommendation(
    dimensionScores,
    personaAttempts,
    copyEvaluation,
    factCheck,
  );

  return {
    dimensionScores,
    overallScore,
    scoreBucket,
    confidence,
    primaryRecommendation,
    evaluatorsAttempted,
    evaluatorsSucceeded,
    gaps,
  };
}

/**
 * A real, specific sentence derived from the actual evaluator outputs — never a generic "improve
 * the ad". Picks the lowest-scoring real dimension and cites the concrete evaluator reasoning (a
 * copy-evaluator weakness, or the highest-severity real simulated objection) that drove it.
 */
function buildPrimaryRecommendation(
  dimensionScores: readonly StressTestDimensionScore[],
  personaAttempts: readonly StressTestPersonaAttempt[],
  copyEvaluation: StressTestCopyEvaluationResult,
  factCheck: StressTestFactCheckResult,
): string {
  if (dimensionScores.length === 0) {
    return "Tidak ada evaluator yang berhasil menghasilkan skor nyata pada run ini — jalankan ulang creative stress test setelah masalah provider LLM teratasi.";
  }

  const conflictingClaim = factCheck.findings.find((f) => f.status === "CONFLICTING_CLAIM");
  if (conflictingClaim !== undefined) {
    return `Prioritas utama: klaim "${conflictingClaim.claim}" pada creative ini BERTENTANGAN dengan Listing Knowledge (${conflictingClaim.reasoning}) — perbaiki klaim ini sebelum creative ini dijalankan.`;
  }

  const lowest = [...dimensionScores].sort((a, b) => a.score - b.score)[0];
  if (lowest === undefined) {
    return "Tidak ada evaluator yang berhasil menghasilkan skor nyata pada run ini.";
  }

  if (lowest.dimension === "OBJECTION_HANDLING") {
    const highestSeverity = personaAttempts
      .filter((p) => p.ok && p.critique !== undefined)
      .flatMap((p) =>
        (p.critique?.objections ?? []).map((o) => ({ ...o, personaLabel: p.personaLabel })),
      )
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];
    if (highestSeverity !== undefined) {
      return `Prioritas utama: tangani objection "${highestSeverity.objection}" (severity ${highestSeverity.severity}) yang muncul dari simulasi persona ${highestSeverity.personaLabel} — dimensi Objection Handling adalah yang paling lemah pada run ini.`;
    }
    return "Prioritas utama: perkuat penanganan objection pada creative ini — dimensi Objection Handling adalah yang paling lemah pada run ini.";
  }

  const dimensionCopy = COPY_DIMENSION_BY_KEY[lowest.dimension];
  const detail = dimensionCopy !== undefined ? copyEvaluation[dimensionCopy] : undefined;
  if (detail !== undefined) {
    return `Prioritas utama: perbaiki ${DIMENSION_LABEL[lowest.dimension]} — ${detail.reasoning}`;
  }
  return `Prioritas utama: perbaiki dimensi ${DIMENSION_LABEL[lowest.dimension]} (skor terendah pada run ini).`;
}

const SEVERITY_RANK: Record<StressTestObjectionSeverity, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

const COPY_DIMENSION_BY_KEY: Partial<
  Record<StressTestDimensionKey, "hookClarity" | "offerStrength" | "ctaSpecificity">
> = {
  HOOK: "hookClarity",
  OFFER: "offerStrength",
  CTA: "ctaSpecificity",
};

const DIMENSION_LABEL: Record<StressTestDimensionKey, string> = {
  HOOK: "Hook",
  OFFER: "Offer",
  OBJECTION_HANDLING: "Objection Handling",
  CTA: "CTA",
};
