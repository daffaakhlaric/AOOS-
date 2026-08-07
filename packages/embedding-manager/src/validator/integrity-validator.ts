import type {
  EmbeddingValidatorStageIssue,
  EmbeddingValidatorStageResult,
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
} from "../contracts/i-embedding-validator.js";

/** Stage 11 — Integrity: cross-record consistency — tenantId must agree across Metadata/Context, and (when present) resolved Provider/Model/Namespace tenantId must match Metadata tenantId. */
export class IntegrityValidator implements IEmbeddingValidatorStage {
  readonly name = "integrity";

  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult {
    const issues: EmbeddingValidatorStageIssue[] = [];
    if (input.metadata.tenantId !== input.context.tenantId) {
      issues.push({
        path: "context.tenantId",
        message: "Context tenantId must match Metadata tenantId",
      });
    }
    if (input.resolvedProvider && input.resolvedProvider.tenantId !== input.metadata.tenantId) {
      issues.push({
        path: "resolvedProvider.tenantId",
        message: "Provider tenantId must match Metadata tenantId",
      });
    }
    if (input.resolvedModel && input.resolvedModel.tenantId !== input.metadata.tenantId) {
      issues.push({
        path: "resolvedModel.tenantId",
        message: "Model tenantId must match Metadata tenantId",
      });
    }
    if (input.resolvedNamespace && input.resolvedNamespace.tenantId !== input.metadata.tenantId) {
      issues.push({
        path: "resolvedNamespace.tenantId",
        message: "Namespace tenantId must match Metadata tenantId",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
