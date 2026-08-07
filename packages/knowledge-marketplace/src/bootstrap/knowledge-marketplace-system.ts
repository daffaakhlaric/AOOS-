import type { IPublisher } from "@aos/event-bus";

import { KnowledgeMarketplace } from "../marketplace/knowledge-marketplace.js";

/**
 * "KnowledgeMarketplaceSystem" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Public
 * API") — the composition root that can be registered as an `IModule`.
 */
export class KnowledgeMarketplaceSystem {
  readonly name = "@aos/knowledge-marketplace";
  readonly version = "0.1.0";
  readonly marketplace: KnowledgeMarketplace;

  constructor(publisher: IPublisher) {
    this.marketplace = new KnowledgeMarketplace(publisher);
  }

  async start(): Promise<void> {
    /* no-op — in-memory initialization is synchronous */
  }

  async stop(): Promise<void> {
    /* no-op — no resources to release */
  }
}
