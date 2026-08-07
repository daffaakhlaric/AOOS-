import type {
  EmbeddingValidatorStageIssue,
  EmbeddingValidatorStageResult,
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
} from "../contracts/i-embedding-validator.js";

/** Stage 2 — Metadata: title/tenantId presence and well-formed timestamps on the Metadata record. */
export class MetadataValidator implements IEmbeddingValidatorStage {
  readonly name = "metadata";

  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult {
    const issues: EmbeddingValidatorStageIssue[] = [];
    if (input.metadata.title.trim().length === 0) {
      issues.push({ path: "metadata.title", message: "Metadata title must not be empty" });
    }
    if (input.metadata.tenantId.trim().length === 0) {
      issues.push({ path: "metadata.tenantId", message: "Metadata tenantId must not be empty" });
    }
    if (Number.isNaN(Date.parse(input.metadata.createdAt))) {
      issues.push({
        path: "metadata.createdAt",
        message: "Metadata createdAt must be a valid ISO timestamp",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
