/**
 * Local, self-contained event-publishing contract. This package never imports `@aos/event-bus` —
 * a host application may supply any implementation of this interface (e.g. an adapter that
 * forwards to the real AOS event bus) via `KnowledgeGraphSystem` bootstrap options. When none is
 * supplied, `InMemoryEventPublisher` is used by default (see `src/events/`).
 */
export interface IKnowledgeGraphEventPublisher {
  publish(eventType: string, payload: Readonly<Record<string, unknown>>): void | Promise<void>;
}
