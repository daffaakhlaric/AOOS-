/**
 * "IKnowledgeGenerationPublisher" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied publishing
 * adapter that pushes a completed `KnowledgeGenerationResult` into a downstream
 * knowledge base. Distinct from the real `@aos/event-bus` `IPublisher` this package
 * already depends on for its 8 Events.
 */
export interface IKnowledgeGenerationPublisher {
  publish(generationId: string, resultId: string): Promise<void>;
}
