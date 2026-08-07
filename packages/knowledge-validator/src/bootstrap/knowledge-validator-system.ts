import type { IPublisher } from "@aos/event-bus";

import type { KnowledgeValidatorConfig } from "../config/knowledge-validator-config.js";
import { KnowledgeValidator } from "../validation/knowledge-validator.js";

/**
 * "KnowledgeValidatorSystem" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Public
 * API") — the composition root that can be registered as an `IModule`.
 */
export class KnowledgeValidatorSystem {
  readonly name = "@aos/knowledge-validator";
  readonly version = "0.1.0";
  readonly validator: KnowledgeValidator;

  constructor(publisher: IPublisher, config: KnowledgeValidatorConfig = {}) {
    this.validator = new KnowledgeValidator(publisher, config);
  }

  async start(): Promise<void> {
    /* no-op — in-memory initialization is synchronous */
  }

  async stop(): Promise<void> {
    /* no-op — no resources to release */
  }
}
