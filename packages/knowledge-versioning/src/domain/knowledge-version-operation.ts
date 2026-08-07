/**
 * "VERSION OPERATIONS: CreateVersion, PublishVersion, ArchiveVersion, RestoreVersion,
 * RollbackVersion, MergeVersion, CompareVersion, CloneVersion, ForkVersion,
 * SnapshotVersion, DestroyVersion." (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md) — the
 * exact 11 operations from the prompt. "Implement CONTRACTS ONLY. ... No merge
 * algorithm. No diff engine. No file manipulation. Metadata only." — every operation is
 * pure metadata/lifecycle work; real merge/diff/storage algorithms belong behind the
 * Extension Point interfaces in `contracts/`.
 */
export enum KnowledgeVersionOperation {
  CREATE_VERSION = "createVersion",
  PUBLISH_VERSION = "publishVersion",
  ARCHIVE_VERSION = "archiveVersion",
  RESTORE_VERSION = "restoreVersion",
  ROLLBACK_VERSION = "rollbackVersion",
  MERGE_VERSION = "mergeVersion",
  COMPARE_VERSION = "compareVersion",
  CLONE_VERSION = "cloneVersion",
  FORK_VERSION = "forkVersion",
  SNAPSHOT_VERSION = "snapshotVersion",
  DESTROY_VERSION = "destroyVersion",
}
