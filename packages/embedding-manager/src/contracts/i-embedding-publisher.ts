/** "IEmbeddingPublisher" — interface ONLY. A caller-supplied secondary event sink, distinct from the real `@aos/event-bus` `IPublisher` this package always publishes through. */
export interface IEmbeddingPublisher {
  publish(eventType: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
}
