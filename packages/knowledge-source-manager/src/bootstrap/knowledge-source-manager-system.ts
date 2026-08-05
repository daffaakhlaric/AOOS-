import type { IPublisher } from "@aos/event-bus";
import type { IModule } from "@aos/runtime-kernel";

import type { KnowledgeSourceManagerConfig } from "../config/knowledge-source-manager-config.js";
import { KnowledgeSourceEvents } from "../events/knowledge-source-events.js";
import { KnowledgeSourceManager } from "../manager/knowledge-source-manager.js";

/**
 * "KnowledgeSourceManagerSystem" (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md —
 * "PUBLIC API") — composition root wrapping `KnowledgeSourceManager` as a Kernel Module.
 * Not yet wired into any actual Kernel bootstrap call (no application does that in this
 * Engineering Task).
 */
export class KnowledgeSourceManagerSystem implements IModule {
  readonly name = "KnowledgeSourceManagerSystemModule";
  readonly version = "0.1.0";
  readonly manager: KnowledgeSourceManager;

  constructor(publisher: IPublisher, config?: KnowledgeSourceManagerConfig) {
    this.manager = new KnowledgeSourceManager({
      events: new KnowledgeSourceEvents(publisher),
      config,
    });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Manager façade is already constructed and ready to accept create() calls.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release.
  }
}
