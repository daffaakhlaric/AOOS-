import type {
  ValidatorStageIssue,
  ValidatorStageResult,
  IKnowledgeValidatorStage,
  KnowledgeValidatorValidationInput,
} from "../contracts/i-knowledge-validator-validator.js";

/** Stage 11 — Integrity: cross-record consistency — tenantId must agree across Metadata/Context, and (when both present) Policy tenantId must match Metadata tenantId. */
export class IntegrityValidator implements IKnowledgeValidatorStage {
  readonly name = "integrity";

  validate(input: KnowledgeValidatorValidationInput): ValidatorStageResult {
    const issues: ValidatorStageIssue[] = [];
    if (input.metadata.tenantId !== input.context.tenantId) {
      issues.push({
        path: "context.tenantId",
        message: "Context tenantId must match Metadata tenantId",
      });
    }
    if (input.policy !== undefined && input.policy.tenantId !== input.metadata.tenantId) {
      issues.push({
        path: "policy.tenantId",
        message: "Policy tenantId must match Metadata tenantId",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
