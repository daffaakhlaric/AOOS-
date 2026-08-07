import type { IKnowledgeAuditProvider } from "../contracts/i-knowledge-audit-provider.js";
import type { IKnowledgeBranchProvider } from "../contracts/i-knowledge-branch-provider.js";
import type { IKnowledgeComparisonEngine } from "../contracts/i-knowledge-comparison-engine.js";
import type { IKnowledgeConflictResolver } from "../contracts/i-knowledge-conflict-resolver.js";
import type { IKnowledgeDiffProvider } from "../contracts/i-knowledge-diff-provider.js";
import type { IKnowledgeMergeStrategy } from "../contracts/i-knowledge-merge-strategy.js";
import type { IKnowledgeRollbackProvider } from "../contracts/i-knowledge-rollback-provider.js";
import type { IKnowledgeSnapshotProvider } from "../contracts/i-knowledge-snapshot-provider.js";
import type { IKnowledgeVersionPublisher } from "../contracts/i-knowledge-version-publisher.js";
import type { IKnowledgeVersionStorage } from "../contracts/i-knowledge-version-storage.js";

/**
 * "EXTENSION POINTS: Create INTERFACES ONLY. Do NOT implement."
 * (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md) — every field is optional, and none is
 * ever invoked by this package's own operations unless a caller supplies one; the 11
 * Version Operations remain pure metadata/lifecycle work with or without any of these
 * configured.
 */
export interface KnowledgeVersioningConfig {
  readonly mergeStrategy?: IKnowledgeMergeStrategy;
  readonly comparisonEngine?: IKnowledgeComparisonEngine;
  readonly diffProvider?: IKnowledgeDiffProvider;
  readonly snapshotProvider?: IKnowledgeSnapshotProvider;
  readonly rollbackProvider?: IKnowledgeRollbackProvider;
  readonly branchProvider?: IKnowledgeBranchProvider;
  readonly storage?: IKnowledgeVersionStorage;
  readonly auditProvider?: IKnowledgeAuditProvider;
  readonly conflictResolver?: IKnowledgeConflictResolver;
  readonly publisher?: IKnowledgeVersionPublisher;
}
