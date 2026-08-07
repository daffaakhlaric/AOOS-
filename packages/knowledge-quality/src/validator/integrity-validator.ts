import type {
  QualityValidationIssue,
  QualityValidationResult,
  IKnowledgeQualityValidator,
  KnowledgeQualityValidationInput,
} from "../contracts/i-knowledge-quality-validator.js";

/** Stage 11 — Integrity: cross-record consistency — tenantId must agree across Metadata/Context, and (when both present) Profile tenantId must match Metadata tenantId. */
export class IntegrityValidator implements IKnowledgeQualityValidator {
  readonly name = "integrity";

  validate(input: KnowledgeQualityValidationInput): QualityValidationResult {
    const issues: QualityValidationIssue[] = [];
    if (input.metadata.tenantId !== input.context.tenantId) {
      issues.push({
        path: "context.tenantId",
        message: "Context tenantId must match Metadata tenantId",
      });
    }
    if (input.profile !== undefined && input.profile.tenantId !== input.metadata.tenantId) {
      issues.push({
        path: "profile.tenantId",
        message: "Profile tenantId must match Metadata tenantId",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
