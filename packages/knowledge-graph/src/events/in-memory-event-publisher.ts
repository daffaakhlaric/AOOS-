import type { IKnowledgeGraphEventPublisher } from "../contracts/i-knowledge-graph-event-publisher.js";

export type KnowledgeGraphEventHandler = (payload: Readonly<Record<string, unknown>>) => void;

export interface RecordedKnowledgeGraphEvent {
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly publishedAt: number;
}

/**
 * Default `IKnowledgeGraphEventPublisher` implementation: a simple in-memory listener registry
 * (`on`/`publish`) plus a rolling history buffer callers can inspect (useful for tests and for
 * hosts that want to bridge events onward without this package depending on `@aos/event-bus`).
 */
export class InMemoryEventPublisher implements IKnowledgeGraphEventPublisher {
  private readonly handlers = new Map<string, Set<KnowledgeGraphEventHandler>>();
  private readonly history: RecordedKnowledgeGraphEvent[] = [];

  publish(eventType: string, payload: Readonly<Record<string, unknown>>): void {
    this.history.push({ eventType, payload, publishedAt: Date.now() });
    for (const handler of this.handlers.get(eventType) ?? []) {
      handler(payload);
    }
  }

  on(eventType: string, handler: KnowledgeGraphEventHandler): () => void {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, new Set());
    this.handlers.get(eventType)!.add(handler);
    return () => this.handlers.get(eventType)?.delete(handler);
  }

  getHistory(): readonly RecordedKnowledgeGraphEvent[] {
    return this.history;
  }

  clearHistory(): void {
    this.history.length = 0;
  }
}
