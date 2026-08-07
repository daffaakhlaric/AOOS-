import type { IPublisher } from "@aos/event-bus";
import type { IModule } from "@aos/runtime-kernel";

import type { KnowledgeVersioningConfig } from "../config/knowledge-versioning-config.js";
import { KnowledgeVersionEvents } from "../events/knowledge-version-events.js";
import { KnowledgeVersioning } from "../versioning/knowledge-versioning.js";

/**
 * "KnowledgeVersionSystem" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Public API") —
 * composition root wrapping `KnowledgeVersioning` as a Kernel Module. Not yet wired into
 * any actual Kernel bootstrap call (no application does that in this Engineering Task).
 */
export class KnowledgeVersionSystem implements IModule {
  readonly name = "KnowledgeVersionSystemModule";
  readonly version = "0.1.0";
  readonly versioning: KnowledgeVersioning;

  constructor(publisher: IPublisher, config?: KnowledgeVersioningConfig) {
    this.versioning = new KnowledgeVersioning({
      events: new KnowledgeVersionEvents(publisher),
      config,
    });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the KnowledgeVersioning façade is already constructed and ready.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release.
  }
}
