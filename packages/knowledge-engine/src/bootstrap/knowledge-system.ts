import type { IPublisher } from "@aos/event-bus";
import type { IModule } from "@aos/runtime-kernel";

import type { KnowledgeEngineConfig } from "../config/knowledge-engine-config.js";
import { KnowledgeEngine } from "../engine/knowledge-engine.js";
import { KnowledgeEvents } from "../events/knowledge-events.js";

/**
 * The Knowledge System — composition root wrapping `KnowledgeEngine` as a Kernel Module,
 * mirroring `@aos/workflow-integration`'s `WorkflowIntegrationSystem`. Not yet wired into
 * any actual Kernel bootstrap call (no application does that in this Engineering Task).
 */
export class KnowledgeSystem implements IModule {
  readonly name = "KnowledgeSystemModule";
  readonly version = "0.1.0";
  readonly engine: KnowledgeEngine;

  constructor(publisher: IPublisher, config?: KnowledgeEngineConfig) {
    this.engine = new KnowledgeEngine({ events: new KnowledgeEvents(publisher), config });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Engine is already constructed and ready to accept calls.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release.
  }
}
