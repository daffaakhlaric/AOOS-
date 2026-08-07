/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgePolicyPublisher {
  publish(event: Readonly<Record<string, unknown>>): Promise<void>;
}
