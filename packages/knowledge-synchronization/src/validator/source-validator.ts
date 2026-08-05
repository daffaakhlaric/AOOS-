import type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationResult,
} from "./i-knowledge-synchronization-validator.js";

/** Flags a blank `job.sourceId`/`context.sourceId`, and a mismatch between the two. */
export class SourceValidator implements IKnowledgeSynchronizationValidatorStage {
  readonly name = "source";

  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult {
    const issues = [];
    if (input.job.sourceId.trim().length === 0) {
      issues.push({ path: "job.sourceId", message: "Job sourceId must not be empty" });
    }
    if (input.context.sourceId.trim().length === 0) {
      issues.push({ path: "context.sourceId", message: "Context sourceId must not be empty" });
    }
    if (input.job.sourceId !== input.context.sourceId) {
      issues.push({ path: "job.sourceId", message: "Job sourceId must match Context sourceId" });
    }
    return { valid: issues.length === 0, issues };
  }
}
