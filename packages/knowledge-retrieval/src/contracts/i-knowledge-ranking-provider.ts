import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";
import type { KnowledgeQuery } from "../domain/knowledge-query.js";
import type { KnowledgeResult } from "../domain/knowledge-result.js";

/** Interface only — no implementation in this package. "RANKING ENGINE ... No algorithms. Only contracts." A future provider (BM25/Hybrid/Semantic/Cross Encoder/Vector/Rule Based/LLM Ranking — see `KnowledgeRankingStrategy`) re-orders and re-scores Results. */
export interface IKnowledgeRankingProvider {
  rank(
    results: readonly KnowledgeResult[],
    query: KnowledgeQuery,
    context: KnowledgeQueryContext,
  ): Promise<readonly KnowledgeResult[]>;
}
