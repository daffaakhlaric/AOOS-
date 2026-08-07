/**
 * "EVENTS: GenerationCreated, GenerationQueued, GenerationStarted, GenerationCompleted,
 * GenerationFailed, GenerationCancelled, GenerationArchived, GenerationDestroyed."
 * (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) — the exact 8 events.
 */
export enum KnowledgeGeneratorEventType {
  GENERATION_CREATED = "knowledge.generation.created",
  GENERATION_QUEUED = "knowledge.generation.queued",
  GENERATION_STARTED = "knowledge.generation.started",
  GENERATION_COMPLETED = "knowledge.generation.completed",
  GENERATION_FAILED = "knowledge.generation.failed",
  GENERATION_CANCELLED = "knowledge.generation.cancelled",
  GENERATION_ARCHIVED = "knowledge.generation.archived",
  GENERATION_DESTROYED = "knowledge.generation.destroyed",
}
