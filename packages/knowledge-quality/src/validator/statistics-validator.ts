import type {
  QualityValidationIssue,
  QualityValidationResult,
  IKnowledgeQualityValidator,
  KnowledgeQualityValidationInput,
} from "../contracts/i-knowledge-quality-validator.js";

/**
 * Stage 10 — Statistics: when a `KnowledgeQualityAssessmentStatisticsSnapshot` is
 * supplied on the input, checks that its counters are well-formed and internally
 * consistent — no negative counts, and `completedCount + failedCount` never exceeds
 * `requestedCount`. Distinct from the actual `KnowledgeQualityStatistics` class, which
 * owns the real running counters this stage merely sanity-checks a snapshot of; see
 * docs/005.7L-KNOWLEDGE-QUALITY-ENGINE-REPORT.md — "Validation" for the full
 * Validator-stage-vs-domain-class distinction.
 */
export class StatisticsValidator implements IKnowledgeQualityValidator {
  readonly name = "statistics";

  validate(input: KnowledgeQualityValidationInput): QualityValidationResult {
    const issues: QualityValidationIssue[] = [];
    const snapshot = input.statisticsSnapshot;
    if (snapshot) {
      if (snapshot.requestedCount < 0) {
        issues.push({
          path: "statisticsSnapshot.requestedCount",
          message: "requestedCount must not be negative",
        });
      }
      if (snapshot.completedCount < 0) {
        issues.push({
          path: "statisticsSnapshot.completedCount",
          message: "completedCount must not be negative",
        });
      }
      if (snapshot.failedCount < 0) {
        issues.push({
          path: "statisticsSnapshot.failedCount",
          message: "failedCount must not be negative",
        });
      }
      if (snapshot.completedCount + snapshot.failedCount > snapshot.requestedCount) {
        issues.push({
          path: "statisticsSnapshot",
          message: "completedCount + failedCount must not exceed requestedCount",
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
