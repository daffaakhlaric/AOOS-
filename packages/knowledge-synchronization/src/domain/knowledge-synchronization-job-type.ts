/** "SYNCHRONIZATION JOB: Support Manual Sync, Scheduled Sync, Incremental Sync, Full Sync, Version Sync, Metadata Sync, Permission Sync, Policy Sync, Relationship Sync, Template Sync." (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — the 10 Job types `KnowledgeSynchronizationJob.type` can carry. */
export enum KnowledgeSynchronizationJobType {
  MANUAL_SYNC = "manual_sync",
  SCHEDULED_SYNC = "scheduled_sync",
  INCREMENTAL_SYNC = "incremental_sync",
  FULL_SYNC = "full_sync",
  VERSION_SYNC = "version_sync",
  METADATA_SYNC = "metadata_sync",
  PERMISSION_SYNC = "permission_sync",
  POLICY_SYNC = "policy_sync",
  RELATIONSHIP_SYNC = "relationship_sync",
  TEMPLATE_SYNC = "template_sync",
}
