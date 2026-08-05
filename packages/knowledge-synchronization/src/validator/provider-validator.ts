import type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationResult,
} from "./i-knowledge-synchronization-validator.js";

/** Flags a blank `job.providerId`/`context.providerId`, and a mismatch between the two. */
export class ProviderValidator implements IKnowledgeSynchronizationValidatorStage {
  readonly name = "provider";

  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult {
    const issues = [];
    if (input.job.providerId.trim().length === 0) {
      issues.push({ path: "job.providerId", message: "Job providerId must not be empty" });
    }
    if (input.context.providerId.trim().length === 0) {
      issues.push({ path: "context.providerId", message: "Context providerId must not be empty" });
    }
    if (input.job.providerId !== input.context.providerId) {
      issues.push({
        path: "job.providerId",
        message: "Job providerId must match Context providerId",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
