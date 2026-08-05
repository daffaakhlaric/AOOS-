/** "SCHEDULER: Support Reindex, Incremental, Full, Version Update, Policy Update, Relationship Update." (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md) — the 6 job kinds `KnowledgeIndexScheduler` tracks. */
export enum KnowledgeIndexScheduleJobType {
  REINDEX = "reindex",
  INCREMENTAL = "incremental",
  FULL = "full",
  VERSION_UPDATE = "version_update",
  POLICY_UPDATE = "policy_update",
  RELATIONSHIP_UPDATE = "relationship_update",
}
