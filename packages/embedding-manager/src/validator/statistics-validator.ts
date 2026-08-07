import type {
  EmbeddingValidatorStageIssue,
  EmbeddingValidatorStageResult,
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
} from "../contracts/i-embedding-validator.js";

/** Stage 10 — Statistics: when a snapshot is supplied, every counter must be non-negative. */
export class StatisticsValidator implements IEmbeddingValidatorStage {
  readonly name = "statistics";

  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult {
    const issues: EmbeddingValidatorStageIssue[] = [];
    const snapshot = input.statisticsSnapshot;
    if (snapshot) {
      const counters: readonly [string, number][] = [
        ["requestedCount", snapshot.requestedCount],
        ["completedCount", snapshot.completedCount],
        ["failedCount", snapshot.failedCount],
        ["cancelledCount", snapshot.cancelledCount],
      ];
      for (const [path, value] of counters) {
        if (value < 0) {
          issues.push({
            path: `statisticsSnapshot.${path}`,
            message: `${path} must not be negative`,
          });
        }
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
