import type {
  IKnowledgeRetrievalValidatorStage,
  KnowledgeRetrievalValidationInput,
  KnowledgeRetrievalValidationResult,
} from "./i-knowledge-retrieval-validator.js";

/** Flags duplicate entries in `query.filters.tags`. */
export class FilterValidator implements IKnowledgeRetrievalValidatorStage {
  readonly name = "filter";

  validate(input: KnowledgeRetrievalValidationInput): KnowledgeRetrievalValidationResult {
    const { tags } = input.query.filters;
    if (tags && new Set(tags).size !== tags.length) {
      return {
        valid: false,
        issues: [
          { path: "query.filters.tags", message: "Filter tags must not contain duplicates" },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
