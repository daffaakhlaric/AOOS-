import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";
import type { KnowledgeQuery } from "../domain/knowledge-query.js";

export interface KnowledgeRetrievalValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface KnowledgeRetrievalValidationResult {
  readonly valid: boolean;
  readonly issues: readonly KnowledgeRetrievalValidationIssue[];
}

export interface KnowledgeRetrievalValidationInput {
  readonly query: KnowledgeQuery;
  readonly context: KnowledgeQueryContext;
}

/** One stage of `KnowledgeRetrievalValidator` (Query/Context/SearchMode/Filter/Limit — docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md — "VALIDATOR"). */
export interface IKnowledgeRetrievalValidatorStage {
  readonly name: string;
  validate(input: KnowledgeRetrievalValidationInput): KnowledgeRetrievalValidationResult;
}
