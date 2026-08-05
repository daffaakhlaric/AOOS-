import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";
import type { KnowledgeQuery } from "../domain/knowledge-query.js";

/** The extension point the Pipeline's early Policy stage calls — a coarse-grained "may this Context run this Query at all" gate, distinct from `KnowledgePolicyResolver`'s per-Result filtering. Permissive by default when unconfigured. */
export interface IQueryPolicyChecker {
  check(query: KnowledgeQuery, context: KnowledgeQueryContext): boolean | Promise<boolean>;
}
