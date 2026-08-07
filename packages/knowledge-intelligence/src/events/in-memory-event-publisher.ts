import type { IClock } from "../contracts/i-clock.js";
import type { IKnowledgeIntelligenceEventPublisher } from "../contracts/i-knowledge-intelligence-event-publisher.js";
import { SystemClock } from "../utils/clock.js";

export type KnowledgeIntelligenceEventHandler = (
  payload: Readonly<Record<string, unknown>>,
) => void;

export interface RecordedKnowledgeIntelligenceEvent {
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly publishedAt: number;
}

/**
 * Default `IKnowledgeIntelligenceEventPublisher` implementation: a simple in-memory listener
 * registry (`on`/`publish`) plus a rolling history buffer callers can inspect (useful for tests
 * and for hosts that want to bridge events onward without this package depending on
 * `@aos/event-bus`).
 */
export class InMemoryEventPublisher implements IKnowledgeIntelligenceEventPublisher {
  private readonly handlers = new Map<string, Set<KnowledgeIntelligenceEventHandler>>();
  private readonly history: RecordedKnowledgeIntelligenceEvent[] = [];
  private readonly clock: IClock;

  constructor(clock: IClock = new SystemClock()) {
    this.clock = clock;
  }

  publish(eventType: string, payload: Readonly<Record<string, unknown>>): void {
    this.history.push({ eventType, payload, publishedAt: this.clock.now() });
    for (const handler of this.handlers.get(eventType) ?? []) {
      handler(payload);
    }
  }

  on(eventType: string, handler: KnowledgeIntelligenceEventHandler): () => void {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, new Set());
    this.handlers.get(eventType)!.add(handler);
    return () => this.handlers.get(eventType)?.delete(handler);
  }

  getHistory(): readonly RecordedKnowledgeIntelligenceEvent[] {
    return this.history;
  }

  clearHistory(): void {
    this.history.length = 0;
  }
}
