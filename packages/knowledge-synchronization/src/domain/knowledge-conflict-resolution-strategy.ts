/** "CONFLICT RESOLUTION: Create interface-only contracts. Last Write Wins, Version Based, Manual Approval, Merge, Custom Strategy. No implementation." (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — the 5 strategies tagging which registered `IKnowledgeSynchronizationConflictResolver` a caller wants. */
export enum KnowledgeConflictResolutionStrategy {
  LAST_WRITE_WINS = "last_write_wins",
  VERSION_BASED = "version_based",
  MANUAL_APPROVAL = "manual_approval",
  MERGE = "merge",
  CUSTOM = "custom",
}
