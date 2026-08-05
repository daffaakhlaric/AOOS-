import type { IPublisher } from "@aos/event-bus";
import type { KnowledgeEngine } from "@aos/knowledge-engine";
import type { IModule } from "@aos/runtime-kernel";

import type { KnowledgeRuntimeConfig } from "../config/knowledge-runtime-config.js";
import { KnowledgeRuntimeEvents } from "../events/knowledge-runtime-events.js";
import { KnowledgeRuntime } from "../runtime/knowledge-runtime.js";

/**
 * The Knowledge Runtime System — composition root wrapping `KnowledgeRuntime` as a Kernel
 * Module, mirroring `@aos/workflow-runtime`'s `WorkflowRuntimeSystem`. Not yet wired into
 * any actual Kernel bootstrap call (no application does that in this Engineering Task).
 */
export class KnowledgeRuntimeSystem implements IModule {
  readonly name = "KnowledgeRuntimeSystemModule";
  readonly version = "0.1.0";
  readonly runtime: KnowledgeRuntime;

  constructor(
    publisher: IPublisher,
    knowledgeEngine: KnowledgeEngine,
    config?: KnowledgeRuntimeConfig,
  ) {
    this.runtime = new KnowledgeRuntime({
      knowledgeEngine,
      events: new KnowledgeRuntimeEvents(publisher),
      config,
    });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Runtime is already constructed and ready to accept createInstance()/lifecycle calls.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release.
  }
}
