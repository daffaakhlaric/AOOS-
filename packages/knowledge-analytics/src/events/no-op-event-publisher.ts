import type { IKnowledgeAnalyticsEventPublisher } from "../contracts/i-knowledge-analytics-event-publisher.js";

/** Discards every event. Useful for tests or hosts that do not care about analytics events. */
export class NoOpEventPublisher implements IKnowledgeAnalyticsEventPublisher {
  publish(): void {
    // Intentionally does nothing.
  }
}
