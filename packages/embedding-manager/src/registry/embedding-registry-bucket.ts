/**
 * "REGISTRY: Buckets — Embedding Registry, Provider Registry, Model Registry, Version
 * Registry, Namespace Registry, Session Registry, Statistics Registry, Audit Registry."
 * (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md) — the exact 8 buckets from the prompt.
 * Notably JOB and CONFIGURATION are NOT Registry buckets in this package — Jobs are
 * tracked via a dedicated ledger on `EmbeddingManagerLedger`, and Configurations via a
 * dedicated map on `EmbeddingResolver`, since the spec enumerates exactly these 8 names,
 * matching the `@aos/knowledge-validator`/`@aos/knowledge-generator` precedent. See
 * docs/005.7N-EMBEDDING-MANAGER-REPORT.md — "Registry" and "Technical Debt" for the full
 * judgment call.
 */
export enum EmbeddingRegistryBucket {
  EMBEDDING = "embedding",
  PROVIDER = "provider",
  MODEL = "model",
  VERSION = "version",
  NAMESPACE = "namespace",
  SESSION = "session",
  STATISTICS = "statistics",
  AUDIT = "audit",
}
