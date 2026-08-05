import type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationResult,
} from "./i-knowledge-synchronization-validator.js";

/** Flags a blank `job.tenantId`/`context.tenantId`, and a mismatch between the two. */
export class TenantValidator implements IKnowledgeSynchronizationValidatorStage {
  readonly name = "tenant";

  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult {
    const issues = [];
    if (input.job.tenantId.trim().length === 0) {
      issues.push({ path: "job.tenantId", message: "Job tenantId must not be empty" });
    }
    if (input.context.tenantId.trim().length === 0) {
      issues.push({ path: "context.tenantId", message: "Context tenantId must not be empty" });
    }
    if (input.job.tenantId !== input.context.tenantId) {
      issues.push({ path: "job.tenantId", message: "Job tenantId must match Context tenantId" });
    }
    return { valid: issues.length === 0, issues };
  }
}
