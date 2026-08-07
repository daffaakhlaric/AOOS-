import type {
  EmbeddingValidatorStageIssue,
  EmbeddingValidatorStageResult,
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
} from "../contracts/i-embedding-validator.js";

/**
 * Stage 12 — Audit: checks that the audit-relevant fields on the Request are present and
 * well-formed BEFORE an operation runs (`requestedBy` actor, well-formed `createdAt`).
 * Distinct from the Pipeline's own Audit stage (Stage 9 of the 10-stage Pipeline), which
 * APPENDS the actual `EmbeddingAudit` entry after the operation completes — this stage
 * is a pre-flight field check, the Pipeline stage is the post-flight side effect.
 */
export class AuditValidator implements IEmbeddingValidatorStage {
  readonly name = "audit";

  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult {
    const issues: EmbeddingValidatorStageIssue[] = [];
    if (input.request.requestedBy.trim().length === 0) {
      issues.push({
        path: "request.requestedBy",
        message: "Request requestedBy (audit actor) must not be empty",
      });
    }
    if (Number.isNaN(Date.parse(input.request.createdAt))) {
      issues.push({
        path: "request.createdAt",
        message: "Request createdAt must be a valid ISO timestamp for audit purposes",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
