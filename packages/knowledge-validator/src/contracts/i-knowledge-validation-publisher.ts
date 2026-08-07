/**
 * "IKnowledgeValidationPublisher" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied publishing
 * adapter that pushes a settled `KnowledgeValidationReport` into a downstream system.
 * Distinct from the real `@aos/event-bus` `IPublisher` this package already depends on
 * for its 11 Events.
 */
export interface IKnowledgeValidationPublisher {
  publish(validationId: string, reportId: string): Promise<void>;
}
