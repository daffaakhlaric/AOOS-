import type { IKnowledgeRankingProvider } from "../contracts/i-knowledge-ranking-provider.js";
import type { KnowledgeRankingStrategy } from "../domain/knowledge-ranking-strategy.js";

export interface RankingRegistration {
  readonly id: KnowledgeRankingStrategy;
  readonly strategy: KnowledgeRankingStrategy;
  readonly provider: IKnowledgeRankingProvider;
}

/** Builds a `RankingRegistration` pairing a `KnowledgeRankingStrategy` with an `IKnowledgeRankingProvider` — the shape `KnowledgeRankingEngine.register()` consumes. No ranking algorithm lives here. */
export class KnowledgeRankingFactory {
  create(
    strategy: KnowledgeRankingStrategy,
    provider: IKnowledgeRankingProvider,
  ): RankingRegistration {
    return { id: strategy, strategy, provider };
  }
}
