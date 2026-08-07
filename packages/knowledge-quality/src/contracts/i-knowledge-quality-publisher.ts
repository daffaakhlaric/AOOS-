/**
 * "IKnowledgeQualityPublisher" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Extension
 * Points") — interface ONLY. A future seam for a caller-supplied publishing adapter
 * that pushes a completed `KnowledgeQualityReport` into a downstream system. Distinct
 * from the real `@aos/event-bus` `IPublisher` this package already depends on for its
 * 10 Events.
 */
export interface IKnowledgeQualityPublisher {
  publish(assessmentId: string, reportId: string): Promise<void>;
}
