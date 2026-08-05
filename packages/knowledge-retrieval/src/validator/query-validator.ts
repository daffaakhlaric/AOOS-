import type {
  IKnowledgeRetrievalValidatorStage,
  KnowledgeRetrievalValidationInput,
  KnowledgeRetrievalValidationResult,
} from "./i-knowledge-retrieval-validator.js";

/** Flags a `KnowledgeQuery` with no `searchModes`, and a blank `text` when the caller supplied neither `text` nor `keywords`. */
export class QueryValidator implements IKnowledgeRetrievalValidatorStage {
  readonly name = "query";

  validate(input: KnowledgeRetrievalValidationInput): KnowledgeRetrievalValidationResult {
    const issues = [];
    if (input.query.searchModes.length === 0) {
      issues.push({
        path: "query.searchModes",
        message: "Query must declare at least one Search Mode",
      });
    }
    if (
      (input.query.text === undefined || input.query.text.trim().length === 0) &&
      input.query.keywords.length === 0
    ) {
      issues.push({ path: "query.text", message: "Query must supply either text or keywords" });
    }
    return { valid: issues.length === 0, issues };
  }
}
