/**
 * "REGISTRY: ... Buckets: Version Registry, Snapshot Registry, Branch Registry, History
 * Registry, Lineage Registry, Metadata Registry, Statistics Registry, Session Registry."
 * (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md) — the exact 8 buckets from the prompt.
 */
export enum KnowledgeVersionRegistryBucket {
  VERSION = "version",
  SNAPSHOT = "snapshot",
  BRANCH = "branch",
  HISTORY = "history",
  LINEAGE = "lineage",
  METADATA = "metadata",
  STATISTICS = "statistics",
  SESSION = "session",
}
