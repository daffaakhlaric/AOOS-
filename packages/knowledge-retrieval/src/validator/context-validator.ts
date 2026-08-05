import type {
  IKnowledgeRetrievalValidatorStage,
  KnowledgeRetrievalValidationInput,
  KnowledgeRetrievalValidationResult,
} from "./i-knowledge-retrieval-validator.js";

/** Flags a `KnowledgeQueryContext` missing `tenantId`/`correlationId`. */
export class ContextValidator implements IKnowledgeRetrievalValidatorStage {
  readonly name = "context";

  validate(input: KnowledgeRetrievalValidationInput): KnowledgeRetrievalValidationResult {
    const issues = [];
    if (input.context.tenantId.trim().length === 0) {
      issues.push({ path: "context.tenantId", message: "Context tenantId must not be empty" });
    }
    if (input.context.correlationId.trim().length === 0) {
      issues.push({
        path: "context.correlationId",
        message: "Context correlationId must not be empty",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
