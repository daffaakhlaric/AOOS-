import type {
  IKnowledgeSourceValidator,
  KnowledgeSourceValidationInput,
  KnowledgeSourceValidationResult,
} from "../contracts/i-knowledge-source-validator.js";

/** Flags a blank `metadata.sourceId`/`context.sourceId`, and a mismatch between the two. */
export class SourceIdValidator implements IKnowledgeSourceValidator {
  readonly name = "sourceId";

  validate(input: KnowledgeSourceValidationInput): KnowledgeSourceValidationResult {
    const issues = [];
    if (input.metadata.sourceId.trim().length === 0) {
      issues.push({ path: "metadata.sourceId", message: "Source sourceId must not be empty" });
    }
    if (input.context.sourceId.trim().length === 0) {
      issues.push({ path: "context.sourceId", message: "Context sourceId must not be empty" });
    }
    if (input.metadata.sourceId !== input.context.sourceId) {
      issues.push({
        path: "metadata.sourceId",
        message: "Source sourceId must match Context sourceId",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
