import type { IPublisher } from "@aos/event-bus";

import { KnowledgePolicy } from "../policy/knowledge-policy.js";

/**
 * "KnowledgePolicySystem" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Public API") —
 * the composition root that can be registered as an `IModule`.
 */
export class KnowledgePolicySystem {
  readonly name = "@aos/knowledge-policy";
  readonly version = "0.1.0";
  readonly policy: KnowledgePolicy;

  constructor(publisher: IPublisher) {
    this.policy = new KnowledgePolicy(publisher);
  }

  async start(): Promise<void> {
    /* no-op — in-memory initialization is synchronous */
  }

  async stop(): Promise<void> {
    /* no-op — no resources to release */
  }
}
