import type { IPublisher } from "@aos/event-bus";

import type { EmbeddingManagerConfig } from "../config/embedding-manager-config.js";
import { EmbeddingManager } from "../embedding/embedding-manager.js";

/**
 * "EmbeddingManagerSystem" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Public API") —
 * the composition root that can be registered as an `IModule`.
 */
export class EmbeddingManagerSystem {
  readonly name = "@aos/embedding-manager";
  readonly version = "0.1.0";
  readonly manager: EmbeddingManager;

  constructor(publisher: IPublisher, config: EmbeddingManagerConfig = {}) {
    this.manager = new EmbeddingManager(publisher, config);
  }

  async start(): Promise<void> {
    /* no-op — in-memory initialization is synchronous */
  }

  async stop(): Promise<void> {
    /* no-op — no resources to release */
  }
}
