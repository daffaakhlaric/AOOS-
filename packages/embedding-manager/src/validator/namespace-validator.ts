import type {
  EmbeddingValidatorStageIssue,
  EmbeddingValidatorStageResult,
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
} from "../contracts/i-embedding-validator.js";

/** Stage 5 — Namespace: when declared, `namespaceId` must be well-formed, and a resolved Namespace must be active. */
export class NamespaceValidator implements IEmbeddingValidatorStage {
  readonly name = "namespace";

  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult {
    const issues: EmbeddingValidatorStageIssue[] = [];
    if (input.request.namespaceId !== undefined && input.request.namespaceId.trim().length === 0) {
      issues.push({
        path: "request.namespaceId",
        message: "Request namespaceId must not be blank when declared",
      });
    }
    if (input.resolvedNamespace && !input.resolvedNamespace.active) {
      issues.push({
        path: "resolvedNamespace.active",
        message: `Namespace "${input.resolvedNamespace.namespaceId}" is not active`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
