import type { IPublisher } from "@aos/event-bus";

import type { KnowledgeQualityConfig } from "../config/knowledge-quality-config.js";
import { KnowledgeQuality } from "../quality/knowledge-quality.js";

/**
 * "KnowledgeQualitySystem" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Public
 * API") — the composition root that can be registered as an `IModule`.
 */
export class KnowledgeQualitySystem {
  readonly name = "@aos/knowledge-quality";
  readonly version = "0.1.0";
  readonly quality: KnowledgeQuality;

  constructor(publisher: IPublisher, config: KnowledgeQualityConfig = {}) {
    this.quality = new KnowledgeQuality(publisher, config);
  }

  async start(): Promise<void> {
    /* no-op — in-memory initialization is synchronous */
  }

  async stop(): Promise<void> {
    /* no-op — no resources to release */
  }
}
