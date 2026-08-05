import type {
  IKnowledgeRetrievalValidatorStage,
  KnowledgeRetrievalValidationInput,
  KnowledgeRetrievalValidationResult,
} from "./i-knowledge-retrieval-validator.js";

const MAX_LIMIT = 200;

/** Flags a `query.limit` above the sane maximum (defends downstream Search Providers from unbounded fan-out). */
export class LimitValidator implements IKnowledgeRetrievalValidatorStage {
  readonly name = "limit";

  validate(input: KnowledgeRetrievalValidationInput): KnowledgeRetrievalValidationResult {
    if (input.query.limit > MAX_LIMIT) {
      return {
        valid: false,
        issues: [
          {
            path: "query.limit",
            message: `Query limit ${input.query.limit} exceeds the maximum of ${MAX_LIMIT}`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
