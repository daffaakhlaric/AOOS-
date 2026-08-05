import type { IPublisher } from "@aos/event-bus";
import type { KnowledgeEngine } from "@aos/knowledge-engine";
import type { KnowledgeIndexing } from "@aos/knowledge-indexing";
import type { IModule } from "@aos/runtime-kernel";

import type { KnowledgeRetrievalConfig } from "../config/knowledge-retrieval-config.js";
import { KnowledgeRetrievalEvents } from "../events/knowledge-retrieval-events.js";
import { KnowledgeRetrieval } from "../retrieval/knowledge-retrieval.js";

/**
 * The Knowledge Retrieval System — composition root wrapping `KnowledgeRetrieval` as a
 * Kernel Module, mirroring `@aos/knowledge-indexing`'s `KnowledgeIndexingSystem`. Not yet
 * wired into any actual Kernel bootstrap call (no application does that in this
 * Engineering Task).
 */
export class KnowledgeRetrievalSystem implements IModule {
  readonly name = "KnowledgeRetrievalSystemModule";
  readonly version = "0.1.0";
  readonly retrieval: KnowledgeRetrieval;

  constructor(
    publisher: IPublisher,
    knowledgeEngine: KnowledgeEngine,
    knowledgeIndexing: KnowledgeIndexing,
    config?: KnowledgeRetrievalConfig,
  ) {
    this.retrieval = new KnowledgeRetrieval({
      knowledgeEngine,
      knowledgeIndexing,
      events: new KnowledgeRetrievalEvents(publisher),
      config,
    });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Retrieval façade is already constructed and ready to accept search() calls.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release.
  }
}
