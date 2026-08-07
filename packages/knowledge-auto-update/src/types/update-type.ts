/** The 13 supported knowledge update types (spec "Supported Update Types"). */
export enum KnowledgeUpdateType {
  Manual = "manual",
  Scheduled = "scheduled",
  Incremental = "incremental",
  Full = "full",
  Refresh = "refresh",
  Synchronization = "synchronization",
  Version = "version",
  Metadata = "metadata",
  Policy = "policy",
  Dependency = "dependency",
  Recovery = "recovery",
  Retry = "retry",
  Emergency = "emergency",
}

/** All 13 `KnowledgeUpdateType` values, in declaration order — used by factories/tests. */
export const ALL_UPDATE_TYPES: readonly KnowledgeUpdateType[] = Object.values(KnowledgeUpdateType);
