/** Deployment verdict for one `JudgementResult` (spec "Grading"). */
export enum Verdict {
  APPROVE = "APPROVE",
  NEEDS_IMPROVEMENT = "NEEDS_IMPROVEMENT",
  FAIL = "FAIL",
}

/**
 * Verdict thresholds (spec "Grading": "APPROVE threshold: overall >= 80"; 60-79 is
 * NEEDS_IMPROVEMENT (Grade B/C); below 60 is FAIL (Grade F)).
 */
export function verdictFromScore(overallScore: number): Verdict {
  if (overallScore >= 80) {
    return Verdict.APPROVE;
  }
  if (overallScore >= 60) {
    return Verdict.NEEDS_IMPROVEMENT;
  }
  return Verdict.FAIL;
}
