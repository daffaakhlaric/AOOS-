import type { IKnowledgeGraphEventPublisher } from "../contracts/i-knowledge-graph-event-publisher.js";

/** Discards every event. Useful for tests or hosts that do not care about graph events. */
export class NoOpEventPublisher implements IKnowledgeGraphEventPublisher {
  publish(): void {
    // Intentionally does nothing.
  }
}
