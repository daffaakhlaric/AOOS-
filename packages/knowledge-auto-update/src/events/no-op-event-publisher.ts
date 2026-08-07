import type { IKnowledgeAutoUpdateEventPublisher } from "../contracts/i-knowledge-auto-update-event-publisher.js";

/** Discards every published event. Useful for hosts/tests that don't care about events. */
export class NoOpEventPublisher implements IKnowledgeAutoUpdateEventPublisher {
  publish(): void {
    // intentionally discarded
  }
}
