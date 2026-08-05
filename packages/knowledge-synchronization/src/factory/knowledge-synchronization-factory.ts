import { SynchronizationContextFactory } from "./synchronization-context-factory.js";
import { SynchronizationJobFactory } from "./synchronization-job-factory.js";
import { SynchronizationPolicyFactory } from "./synchronization-policy-factory.js";
import { SynchronizationSessionFactory } from "./synchronization-session-factory.js";
import { SynchronizationStatisticsFactory } from "./synchronization-statistics-factory.js";

/**
 * "FACTORY: KnowledgeSynchronizationFactory, SynchronizationJobFactory,
 * SynchronizationContextFactory, SynchronizationSessionFactory,
 * SynchronizationPolicyFactory, SynchronizationStatisticsFactory."
 * (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — the top-level façade composing all
 * 5 sub-factories as public readonly fields, mirroring `@aos/knowledge-retrieval`'s
 * `KnowledgeSearchFactory` composition pattern.
 */
export class KnowledgeSynchronizationFactory {
  readonly job = new SynchronizationJobFactory();
  readonly context = new SynchronizationContextFactory();
  readonly session = new SynchronizationSessionFactory();
  readonly policy = new SynchronizationPolicyFactory();
  readonly statistics = new SynchronizationStatisticsFactory();
}
