import { KnowledgeSourceConfigurationFactory } from "./knowledge-source-configuration-factory.js";
import { KnowledgeSourceContextFactory } from "./knowledge-source-context-factory.js";
import { KnowledgeSourceMetadataFactory } from "./knowledge-source-metadata-factory.js";
import { KnowledgeSourceSessionFactory } from "./knowledge-source-session-factory.js";
import { KnowledgeSourceStatisticsFactory } from "./knowledge-source-statistics-factory.js";

/**
 * "FACTORY: KnowledgeSourceFactory, KnowledgeSourceContextFactory,
 * KnowledgeSourceSessionFactory, KnowledgeSourceMetadataFactory,
 * KnowledgeSourceConfigurationFactory, KnowledgeSourceStatisticsFactory."
 * (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md) — the top-level façade composing all
 * 5 sub-factories as public readonly fields.
 */
export class KnowledgeSourceFactory {
  readonly context = new KnowledgeSourceContextFactory();
  readonly session = new KnowledgeSourceSessionFactory();
  readonly metadata = new KnowledgeSourceMetadataFactory();
  readonly configuration = new KnowledgeSourceConfigurationFactory();
  readonly statistics = new KnowledgeSourceStatisticsFactory();
}
