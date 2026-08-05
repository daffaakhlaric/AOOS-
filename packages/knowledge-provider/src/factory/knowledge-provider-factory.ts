import { ProviderCapabilityFactory } from "./provider-capability-factory.js";
import { ProviderContextFactory } from "./provider-context-factory.js";
import { ProviderMetadataFactory } from "./provider-metadata-factory.js";
import { ProviderSessionFactory } from "./provider-session-factory.js";
import { ProviderStatisticsFactory } from "./provider-statistics-factory.js";

/**
 * "FACTORY: KnowledgeProviderFactory, ProviderContextFactory, ProviderSessionFactory,
 * ProviderMetadataFactory, ProviderCapabilityFactory, ProviderStatisticsFactory."
 * (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — the top-level façade composing all 5
 * sub-factories as public readonly fields, mirroring
 * `@aos/knowledge-synchronization`'s `KnowledgeSynchronizationFactory` composition
 * pattern.
 */
export class KnowledgeProviderFactory {
  readonly context = new ProviderContextFactory();
  readonly session = new ProviderSessionFactory();
  readonly metadata = new ProviderMetadataFactory();
  readonly capability = new ProviderCapabilityFactory();
  readonly statistics = new ProviderStatisticsFactory();
}
