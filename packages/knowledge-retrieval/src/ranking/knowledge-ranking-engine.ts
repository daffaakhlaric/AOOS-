import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";
import type { IKnowledgeRankingProvider } from "../contracts/i-knowledge-ranking-provider.js";
import type { KnowledgeQuery } from "../domain/knowledge-query.js";
import type { KnowledgeRankingStrategy } from "../domain/knowledge-ranking-strategy.js";
import type { KnowledgeResult } from "../domain/knowledge-result.js";
import { RankingNotSupportedException } from "../errors/ranking-not-supported-exception.js";
import { KnowledgeRetrievalRegistryBucket } from "../registry/knowledge-retrieval-registry-bucket.js";
import type { KnowledgeRetrievalRegistry } from "../registry/knowledge-retrieval-registry.js";

interface RegisteredRankingProvider extends IKnowledgeRankingProvider {
  readonly id: string;
}

/**
 * "RANKING ENGINE: Support interfaces BM25, Hybrid, Semantic, Cross Encoder, Vector
 * Ranking, Rule Based, LLM Ranking. No algorithms. Only contracts."
 * (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — owns no ranking algorithm itself. When a
 * caller requests a specific `KnowledgeRankingStrategy` with nothing registered for it,
 * throws `RankingNotSupportedException`. When no strategy is requested at all, Results
 * pass through unchanged — a documented no-op, never a silent algorithm.
 */
export class KnowledgeRankingEngine {
  constructor(private readonly registry: KnowledgeRetrievalRegistry) {}

  register(
    strategy: KnowledgeRankingStrategy,
    provider: IKnowledgeRankingProvider,
  ): IKnowledgeRankingProvider {
    return this.registry.replace<RegisteredRankingProvider>(
      KnowledgeRetrievalRegistryBucket.RANKING_STRATEGY,
      { ...provider, id: strategy },
    );
  }

  async rank(
    results: readonly KnowledgeResult[],
    query: KnowledgeQuery,
    context: KnowledgeQueryContext,
    strategy?: KnowledgeRankingStrategy,
  ): Promise<readonly KnowledgeResult[]> {
    if (!strategy) {
      return results;
    }
    const provider = this.registry.get<RegisteredRankingProvider>(
      KnowledgeRetrievalRegistryBucket.RANKING_STRATEGY,
      strategy,
    );
    if (!provider) {
      throw new RankingNotSupportedException(
        `No IKnowledgeRankingProvider is registered for Ranking Strategy "${strategy}"`,
      );
    }
    return provider.rank(results, query, context);
  }

  isSupported(strategy: KnowledgeRankingStrategy): boolean {
    return (
      this.registry.get(KnowledgeRetrievalRegistryBucket.RANKING_STRATEGY, strategy) !== undefined
    );
  }
}
