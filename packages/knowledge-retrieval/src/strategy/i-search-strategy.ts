import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";
import type { KnowledgeQuery } from "../domain/knowledge-query.js";
import type { KnowledgeResult } from "../domain/knowledge-result.js";
import type { KnowledgeSearchMode } from "../domain/knowledge-search-mode.js";
import type { KnowledgeResolver } from "../resolver/knowledge-resolver.js";

/** "SEARCH STRATEGY: Create strategy interfaces ... No implementations." (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — the base shape every named Strategy interface shares. */
export interface IKnowledgeSearchStrategy {
  readonly id: string;
  readonly mode: KnowledgeSearchMode;
  execute(
    query: KnowledgeQuery,
    context: KnowledgeQueryContext,
    resolver: KnowledgeResolver,
  ): Promise<readonly KnowledgeResult[]>;
}
