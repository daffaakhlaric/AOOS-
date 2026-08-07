/**
 * "EVENTS: EmbeddingCreated, EmbeddingQueued, EmbeddingStarted, EmbeddingCompleted,
 * EmbeddingCancelled, EmbeddingFailed, EmbeddingArchived, EmbeddingDestroyed,
 * ProviderRegistered, ModelRegistered, VersionCreated." (docs/PROMPT-005.7N-EMBEDDING-
 * MANAGER.md) — the exact 11 events. Namespace `embedding.*` — NOT `knowledge.embedding.*`
 * — since this package drops the "Knowledge" prefix entirely (`@aos/embedding-manager`,
 * classes `Embedding*`), unlike every prior sibling. A documented judgment call, see
 * docs/005.7N-EMBEDDING-MANAGER-REPORT.md — "Events".
 */
export enum EmbeddingManagerEventType {
  EMBEDDING_CREATED = "embedding.created",
  EMBEDDING_QUEUED = "embedding.queued",
  EMBEDDING_STARTED = "embedding.started",
  EMBEDDING_COMPLETED = "embedding.completed",
  EMBEDDING_CANCELLED = "embedding.cancelled",
  EMBEDDING_FAILED = "embedding.failed",
  EMBEDDING_ARCHIVED = "embedding.archived",
  EMBEDDING_DESTROYED = "embedding.destroyed",
  PROVIDER_REGISTERED = "embedding.provider.registered",
  MODEL_REGISTERED = "embedding.model.registered",
  VERSION_CREATED = "embedding.version.created",
}
