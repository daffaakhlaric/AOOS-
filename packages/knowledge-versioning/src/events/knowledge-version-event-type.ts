/**
 * "EVENTS: VersionCreated, VersionPublished, VersionArchived, VersionRestored,
 * VersionMerged, VersionRolledBack, VersionDestroyed, BranchCreated, SnapshotCreated,
 * HistoryRecorded, ComparisonCompleted." (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md) —
 * the exact 11 events from the prompt.
 */
export enum KnowledgeVersionEventType {
  VERSION_CREATED = "knowledge.version.created",
  VERSION_PUBLISHED = "knowledge.version.published",
  VERSION_ARCHIVED = "knowledge.version.archived",
  VERSION_RESTORED = "knowledge.version.restored",
  VERSION_MERGED = "knowledge.version.merged",
  VERSION_ROLLED_BACK = "knowledge.version.rolledback",
  VERSION_DESTROYED = "knowledge.version.destroyed",
  BRANCH_CREATED = "knowledge.version.branch.created",
  SNAPSHOT_CREATED = "knowledge.version.snapshot.created",
  HISTORY_RECORDED = "knowledge.version.history.recorded",
  COMPARISON_COMPLETED = "knowledge.version.comparison.completed",
}
