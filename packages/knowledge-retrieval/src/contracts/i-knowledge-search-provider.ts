import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";
import type { KnowledgeQuery } from "../domain/knowledge-query.js";
import type { KnowledgeResult } from "../domain/knowledge-result.js";

/** The shared shape every Search Provider extension point implements — interface only, no implementation in this package. */
export interface IKnowledgeSearchProvider {
  search(
    query: KnowledgeQuery,
    context: KnowledgeQueryContext,
  ): Promise<readonly KnowledgeResult[]>;
}
