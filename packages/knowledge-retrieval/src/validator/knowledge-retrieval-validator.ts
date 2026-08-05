import { ContextValidator } from "./context-validator.js";
import { FilterValidator } from "./filter-validator.js";
import type {
  IKnowledgeRetrievalValidatorStage,
  KnowledgeRetrievalValidationInput,
  KnowledgeRetrievalValidationResult,
} from "./i-knowledge-retrieval-validator.js";
import { LimitValidator } from "./limit-validator.js";
import { QueryValidator } from "./query-validator.js";
import { SearchModeValidator } from "./search-mode-validator.js";

/**
 * "VALIDATOR" (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md — "TESTING") — runs 5 stages in
 * fixed order, aggregating every issue without short-circuiting: Query, Context, Search
 * Mode, Filter, Limit.
 */
export class KnowledgeRetrievalValidator {
  private readonly stages: readonly IKnowledgeRetrievalValidatorStage[];

  constructor(extraStages: readonly IKnowledgeRetrievalValidatorStage[] = []) {
    this.stages = [
      new QueryValidator(),
      new ContextValidator(),
      new SearchModeValidator(),
      new FilterValidator(),
      new LimitValidator(),
      ...extraStages,
    ];
  }

  validate(input: KnowledgeRetrievalValidationInput): KnowledgeRetrievalValidationResult {
    const issues = this.stages.flatMap((stage) => stage.validate(input).issues);
    return { valid: issues.length === 0, issues };
  }
}
