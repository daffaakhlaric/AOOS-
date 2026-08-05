import type { IPublisher } from "@aos/event-bus";
import type { IModule } from "@aos/runtime-kernel";

import type { KnowledgeIndexingConfig } from "../config/knowledge-indexing-config.js";
import { KnowledgeIndexEvents } from "../events/knowledge-index-events.js";
import { KnowledgeIndexing } from "../indexing/knowledge-indexing.js";

/**
 * The Knowledge Indexing System — composition root wrapping `KnowledgeIndexing` as a
 * Kernel Module, mirroring `@aos/knowledge-runtime`'s `KnowledgeRuntimeSystem`. Not yet
 * wired into any actual Kernel bootstrap call (no application does that in this
 * Engineering Task).
 */
export class KnowledgeIndexingSystem implements IModule {
  readonly name = "KnowledgeIndexingSystemModule";
  readonly version = "0.1.0";
  readonly indexing: KnowledgeIndexing;

  constructor(publisher: IPublisher, config?: KnowledgeIndexingConfig) {
    this.indexing = new KnowledgeIndexing({ events: new KnowledgeIndexEvents(publisher), config });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Indexing façade is already constructed and ready to accept indexAsset() calls.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release.
  }
}
