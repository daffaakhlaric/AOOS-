export { KnowledgeVersion } from "./knowledge-version.js";
export { KnowledgeBranchType } from "./knowledge-branch-type.js";
export { knowledgeBranchSchema, type KnowledgeBranch } from "./knowledge-branch.js";
export { knowledgeComparisonSchema, type KnowledgeComparison } from "./knowledge-comparison.js";
export {
  KnowledgeHistory,
  knowledgeHistoryEntrySchema,
  type KnowledgeHistoryEntry,
  type RecordKnowledgeHistoryInput,
} from "./knowledge-history.js";
export { KnowledgeLineage, type KnowledgeLineageEdge } from "./knowledge-lineage.js";
export { knowledgeMergeSchema, type KnowledgeMerge } from "./knowledge-merge.js";
export { knowledgeRevisionSchema, type KnowledgeRevision } from "./knowledge-revision.js";
export { knowledgeRollbackSchema, type KnowledgeRollback } from "./knowledge-rollback.js";
export { knowledgeSnapshotSchema, type KnowledgeSnapshot } from "./knowledge-snapshot.js";
export {
  knowledgeVersionAuditEntrySchema,
  type KnowledgeVersionAuditEntry,
} from "./knowledge-version-audit.js";
export type { KnowledgeVersionExecution } from "./knowledge-version-execution.js";
export {
  knowledgeVersionInstanceSchema,
  type KnowledgeVersionInstance,
} from "./knowledge-version-instance.js";
export {
  knowledgeVersionLogEntrySchema,
  type KnowledgeVersionLogEntry,
} from "./knowledge-version-log.js";
export {
  knowledgeVersionMetadataSchema,
  type KnowledgeVersionMetadata,
} from "./knowledge-version-metadata.js";
export { KnowledgeVersionOperation } from "./knowledge-version-operation.js";
export { knowledgeVersionStateSchema } from "./knowledge-version-state-schema.js";
export {
  KNOWLEDGE_VERSION_SETTLED_STATES,
  KNOWLEDGE_VERSION_STATE_TRANSITIONS,
  KNOWLEDGE_VERSION_TERMINAL_STATES,
  KnowledgeVersionState,
} from "./knowledge-version-state.js";
export {
  EMPTY_KNOWLEDGE_VERSION_STATISTICS,
  knowledgeVersionStatisticsSnapshotSchema,
  type KnowledgeVersionStatisticsSnapshot,
} from "./knowledge-version-statistics-snapshot.js";
export {
  knowledgeVersionTraceSchema,
  type KnowledgeVersionTrace,
} from "./knowledge-version-trace.js";
export { NUMERIC_KNOWLEDGE_VERSION_TYPES, KnowledgeVersionType } from "./knowledge-version-type.js";
