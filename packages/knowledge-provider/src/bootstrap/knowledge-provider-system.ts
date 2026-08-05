import type { IPublisher } from "@aos/event-bus";
import type { IModule } from "@aos/runtime-kernel";

import type { KnowledgeProviderConfig } from "../config/knowledge-provider-config.js";
import { KnowledgeProviderEvents } from "../events/knowledge-provider-events.js";
import { KnowledgeProvider } from "../provider/knowledge-provider.js";

/**
 * The Knowledge Provider System — composition root wrapping `KnowledgeProvider` as a
 * Kernel Module, mirroring `@aos/knowledge-synchronization`'s
 * `KnowledgeSynchronizationSystem`. Not yet wired into any actual Kernel bootstrap call
 * (no application does that in this Engineering Task).
 */
export class KnowledgeProviderSystem implements IModule {
  readonly name = "KnowledgeProviderSystemModule";
  readonly version = "0.1.0";
  readonly provider: KnowledgeProvider;

  constructor(publisher: IPublisher, config?: KnowledgeProviderConfig) {
    this.provider = new KnowledgeProvider({
      events: new KnowledgeProviderEvents(publisher),
      config,
    });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Provider façade is already constructed and ready to accept register() calls.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release.
  }
}
