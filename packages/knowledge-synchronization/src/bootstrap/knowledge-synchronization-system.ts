import type { IPublisher } from "@aos/event-bus";
import type { KnowledgeEngine } from "@aos/knowledge-engine";
import type { KnowledgeIndexing } from "@aos/knowledge-indexing";
import type { KnowledgeRetrieval } from "@aos/knowledge-retrieval";
import type { IModule } from "@aos/runtime-kernel";

import type { KnowledgeSynchronizationConfig } from "../config/knowledge-synchronization-config.js";
import { KnowledgeSynchronizationEvents } from "../events/knowledge-synchronization-events.js";
import { KnowledgeSynchronization } from "../synchronization/knowledge-synchronization.js";

/**
 * The Knowledge Synchronization System — composition root wrapping
 * `KnowledgeSynchronization` as a Kernel Module, mirroring
 * `@aos/knowledge-retrieval`'s `KnowledgeRetrievalSystem`. Not yet wired into any actual
 * Kernel bootstrap call (no application does that in this Engineering Task).
 */
export class KnowledgeSynchronizationSystem implements IModule {
  readonly name = "KnowledgeSynchronizationSystemModule";
  readonly version = "0.1.0";
  readonly synchronization: KnowledgeSynchronization;

  constructor(
    publisher: IPublisher,
    knowledgeEngine: KnowledgeEngine,
    knowledgeIndexing: KnowledgeIndexing,
    knowledgeRetrieval: KnowledgeRetrieval,
    config?: KnowledgeSynchronizationConfig,
  ) {
    this.synchronization = new KnowledgeSynchronization({
      knowledgeEngine,
      knowledgeIndexing,
      knowledgeRetrieval,
      events: new KnowledgeSynchronizationEvents(publisher),
      config,
    });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Synchronization façade is already constructed and ready to accept synchronize() calls.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release.
  }
}
