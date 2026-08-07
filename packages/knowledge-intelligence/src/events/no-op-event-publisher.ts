import type { IKnowledgeIntelligenceEventPublisher } from "../contracts/i-knowledge-intelligence-event-publisher.js";

/** Discards every published event. Useful for hosts/tests that don't care about events. */
export class NoOpEventPublisher implements IKnowledgeIntelligenceEventPublisher {
  publish(): void {
    // intentionally discarded
  }
}
