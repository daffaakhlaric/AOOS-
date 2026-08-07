import type { IPublisher } from "@aos/event-bus";

import type { KnowledgeGeneratorConfig } from "../config/knowledge-generator-config.js";
import { KnowledgeGenerator } from "../generator/knowledge-generator.js";

/**
 * "KnowledgeGeneratorSystem" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Public
 * API") — the composition root that can be registered as an `IModule`.
 */
export class KnowledgeGeneratorSystem {
  readonly name = "@aos/knowledge-generator";
  readonly version = "0.1.0";
  readonly generator: KnowledgeGenerator;

  constructor(publisher: IPublisher, config: KnowledgeGeneratorConfig = {}) {
    this.generator = new KnowledgeGenerator(publisher, config);
  }

  async start(): Promise<void> {
    /* no-op — in-memory initialization is synchronous */
  }

  async stop(): Promise<void> {
    /* no-op — no resources to release */
  }
}
