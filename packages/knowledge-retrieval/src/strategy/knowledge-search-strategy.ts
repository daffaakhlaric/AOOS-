import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";
import type { KnowledgeQuery } from "../domain/knowledge-query.js";
import type { KnowledgeResult } from "../domain/knowledge-result.js";
import type { KnowledgeSearchMode } from "../domain/knowledge-search-mode.js";
import { SearchStrategyNotFoundException } from "../errors/search-strategy-not-found-exception.js";
import { KnowledgeRetrievalRegistryBucket } from "../registry/knowledge-retrieval-registry-bucket.js";
import type { KnowledgeRetrievalRegistry } from "../registry/knowledge-retrieval-registry.js";
import type { KnowledgeResolver } from "../resolver/knowledge-resolver.js";

import type { IKnowledgeSearchStrategy } from "./i-search-strategy.js";

/**
 * "KnowledgeSearchStrategy" (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md — "PUBLIC API") —
 * dispatches one `KnowledgeSearchMode` to its registered `IKnowledgeSearchStrategy`
 * (`KnowledgeRetrievalRegistry`'s `SEARCH_STRATEGY` bucket, keyed by mode). Owns no
 * search algorithm itself — "No implementations" — throwing
 * `SearchStrategyNotFoundException` when nothing is registered for the requested mode.
 */
export class KnowledgeSearchStrategy {
  constructor(private readonly registry: KnowledgeRetrievalRegistry) {}

  register(strategy: IKnowledgeSearchStrategy): IKnowledgeSearchStrategy {
    return this.registry.replace(KnowledgeRetrievalRegistryBucket.SEARCH_STRATEGY, {
      ...strategy,
      id: strategy.mode,
    });
  }

  async execute(
    mode: KnowledgeSearchMode,
    query: KnowledgeQuery,
    context: KnowledgeQueryContext,
    resolver: KnowledgeResolver,
  ): Promise<readonly KnowledgeResult[]> {
    const strategy = this.registry.get<IKnowledgeSearchStrategy>(
      KnowledgeRetrievalRegistryBucket.SEARCH_STRATEGY,
      mode,
    );
    if (!strategy) {
      throw new SearchStrategyNotFoundException(
        `No IKnowledgeSearchStrategy is registered for Search Mode "${mode}"`,
      );
    }
    return strategy.execute(query, context, resolver);
  }

  isSupported(mode: KnowledgeSearchMode): boolean {
    return this.registry.get(KnowledgeRetrievalRegistryBucket.SEARCH_STRATEGY, mode) !== undefined;
  }
}
