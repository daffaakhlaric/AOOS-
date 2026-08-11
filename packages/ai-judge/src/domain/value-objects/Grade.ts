/** Letter grade for an `OverallScore` (spec "Grading"). */
export enum Grade {
  A = "A",
  B_PLUS = "B+",
  B = "B",
  C = "C",
  F = "F",
}

/**
 * Grade boundaries (spec "Grading" table, pinned by "Business correctness" grade_boundaries):
 * `>=90` A, `>=80` B+, `>=70` B, `>=60` C, else F. Boundaries are inclusive on the lower bound
 * (score=90.0 -> A, score=89.9 -> B+, etc.)
 */
export function gradeFromScore(overallScore: number): Grade {
  if (overallScore >= 90) {
    return Grade.A;
  }
  if (overallScore >= 80) {
    return Grade.B_PLUS;
  }
  if (overallScore >= 70) {
    return Grade.B;
  }
  if (overallScore >= 60) {
    return Grade.C;
  }
  return Grade.F;
}
