/**
 * Local, self-contained event-publishing contract. This package never imports `@aos/event-bus` —
 * a host application may supply any implementation of this interface (e.g. an adapter that
 * forwards to the real AOS event bus) when constructing `KnowledgeIntelligenceEngine`. When none
 * is supplied, `InMemoryEventPublisher` is used by default (see `src/events/`).
 */
export interface IKnowledgeIntelligenceEventPublisher {
  publish(eventType: string, payload: Readonly<Record<string, unknown>>): void | Promise<void>;
}
