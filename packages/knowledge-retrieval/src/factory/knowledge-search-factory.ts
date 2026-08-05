import { KnowledgeFilterFactory } from "./knowledge-filter-factory.js";
import { KnowledgeQueryFactory } from "./knowledge-query-factory.js";
import { KnowledgeRankingFactory } from "./knowledge-ranking-factory.js";
import { KnowledgeResultFactory } from "./knowledge-result-factory.js";
import { KnowledgeSearchContextFactory } from "./knowledge-search-context-factory.js";
import { KnowledgeSessionFactory } from "./knowledge-session-factory.js";

/**
 * "FACTORY: KnowledgeSearchFactory, KnowledgeQueryFactory, KnowledgeSessionFactory,
 * KnowledgeResultFactory, KnowledgeRankingFactory, KnowledgeFilterFactory,
 * KnowledgeSearchContextFactory." (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — the
 * top-level façade composing all 6 sub-factories as public readonly fields, mirroring
 * `@aos/knowledge-engine`'s `KnowledgeFactory` composition pattern.
 */
export class KnowledgeSearchFactory {
  readonly query = new KnowledgeQueryFactory();
  readonly session = new KnowledgeSessionFactory();
  readonly result = new KnowledgeResultFactory();
  readonly ranking = new KnowledgeRankingFactory();
  readonly filter = new KnowledgeFilterFactory();
  readonly context = new KnowledgeSearchContextFactory();
}
