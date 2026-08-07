import type {
  ValidatorStageIssue,
  ValidatorStageResult,
  IKnowledgeValidatorStage,
  KnowledgeValidatorValidationInput,
} from "../contracts/i-knowledge-validator-validator.js";

/**
 * Stage 10 — Statistics: when a `KnowledgeValidationStatisticsSnapshot` is supplied on
 * the input, checks that its counters are well-formed and internally consistent — no
 * negative counts, and `approvedCount + rejectedCount` never exceeds `requestedCount`.
 * Distinct from the actual `KnowledgeValidatorStatistics` class, which owns the real
 * running counters this stage merely sanity-checks a snapshot of.
 */
export class StatisticsValidator implements IKnowledgeValidatorStage {
  readonly name = "statistics";

  validate(input: KnowledgeValidatorValidationInput): ValidatorStageResult {
    const issues: ValidatorStageIssue[] = [];
    const snapshot = input.statisticsSnapshot;
    if (snapshot) {
      if (snapshot.requestedCount < 0) {
        issues.push({
          path: "statisticsSnapshot.requestedCount",
          message: "requestedCount must not be negative",
        });
      }
      if (snapshot.approvedCount < 0) {
        issues.push({
          path: "statisticsSnapshot.approvedCount",
          message: "approvedCount must not be negative",
        });
      }
      if (snapshot.rejectedCount < 0) {
        issues.push({
          path: "statisticsSnapshot.rejectedCount",
          message: "rejectedCount must not be negative",
        });
      }
      if (snapshot.approvedCount + snapshot.rejectedCount > snapshot.requestedCount) {
        issues.push({
          path: "statisticsSnapshot",
          message: "approvedCount + rejectedCount must not exceed requestedCount",
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
