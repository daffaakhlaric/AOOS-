import type { IKnowledgeAnalyticsEventPublisher } from "../contracts/i-knowledge-analytics-event-publisher.js";
import type { Clock } from "../types/common.js";
import { systemClock } from "../utils/clock.js";

export type KnowledgeAnalyticsEventHandler = (payload: Readonly<Record<string, unknown>>) => void;

export interface RecordedKnowledgeAnalyticsEvent {
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly publishedAt: number;
}

/**
 * Default `IKnowledgeAnalyticsEventPublisher` implementation: a simple in-memory listener registry
 * (`on`/`publish`) plus a rolling history buffer callers can inspect (useful for tests and for
 * hosts that want to bridge events onward without this package depending on `@aos/event-bus`).
 */
export class InMemoryEventPublisher implements IKnowledgeAnalyticsEventPublisher {
  private readonly handlers = new Map<string, Set<KnowledgeAnalyticsEventHandler>>();
  private readonly history: RecordedKnowledgeAnalyticsEvent[] = [];
  private readonly clock: Clock;

  constructor(clock: Clock = systemClock) {
    this.clock = clock;
  }

  publish(eventType: string, payload: Readonly<Record<string, unknown>>): void {
    this.history.push({ eventType, payload, publishedAt: this.clock() });
    for (const handler of this.handlers.get(eventType) ?? []) {
      handler(payload);
    }
  }

  on(eventType: string, handler: KnowledgeAnalyticsEventHandler): () => void {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, new Set());
    this.handlers.get(eventType)!.add(handler);
    return () => this.handlers.get(eventType)?.delete(handler);
  }

  getHistory(): readonly RecordedKnowledgeAnalyticsEvent[] {
    return this.history;
  }

  clearHistory(): void {
    this.history.length = 0;
  }
}
