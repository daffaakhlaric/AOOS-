import type {
  EmbeddingValidatorStageIssue,
  EmbeddingValidatorStageResult,
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
} from "../contracts/i-embedding-validator.js";
import { isEmbeddingManagerToken } from "../token/embedding-manager-token.js";

/** Stage 1 — Identity: blank/mismatched embeddingId between metadata/request/embedding, and a malformed token. */
export class IdentityValidator implements IEmbeddingValidatorStage {
  readonly name = "identity";

  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult {
    const issues: EmbeddingValidatorStageIssue[] = [];
    if (input.embedding.embeddingId.trim().length === 0) {
      issues.push({ path: "embedding.embeddingId", message: "embeddingId must not be empty" });
    }
    if (input.embedding.embeddingId !== input.metadata.embeddingId) {
      issues.push({
        path: "metadata.embeddingId",
        message: "Metadata embeddingId must match Embedding embeddingId",
      });
    }
    if (input.embedding.embeddingId !== input.request.embeddingId) {
      issues.push({
        path: "request.embeddingId",
        message: "Request embeddingId must match Embedding embeddingId",
      });
    }
    if (!isEmbeddingManagerToken(input.context.token)) {
      issues.push({
        path: "context.token",
        message: "Context token must be a well-formed EmbeddingManagerToken",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
