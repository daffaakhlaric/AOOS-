import type { KnowledgeVersionConfigurationRecord } from "../configuration/knowledge-version-configuration-record.js";
import type { KnowledgeVersionContext } from "../context/knowledge-version-context.js";
import type { KnowledgeBranchType } from "../domain/knowledge-branch-type.js";
import type { KnowledgeBranch } from "../domain/knowledge-branch.js";
import type { KnowledgeComparison } from "../domain/knowledge-comparison.js";
import type { KnowledgeMerge } from "../domain/knowledge-merge.js";
import type { KnowledgeRollback } from "../domain/knowledge-rollback.js";
import type { KnowledgeSnapshot } from "../domain/knowledge-snapshot.js";
import type { KnowledgeVersionMetadata } from "../domain/knowledge-version-metadata.js";
import type { KnowledgeVersion } from "../domain/knowledge-version.js";

/**
 * "VERSION OPERATIONS: Implement CONTRACTS ONLY. ... No merge algorithm. No diff
 * engine. No file manipulation. Metadata only."
 * (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md) — the typed input/result contract for
 * each of the 11 operations (CreateVersion, PublishVersion, ArchiveVersion,
 * RestoreVersion, RollbackVersion, MergeVersion, CompareVersion, CloneVersion,
 * ForkVersion, SnapshotVersion, DestroyVersion). `KnowledgeVersioning` implements each
 * as pure metadata/lifecycle work (validate → state machine → history/lineage →
 * metrics → event); real algorithms stay behind the Extension Point interfaces.
 */
export interface CreateVersionInput {
  readonly metadata: KnowledgeVersionMetadata;
  readonly configuration: KnowledgeVersionConfigurationRecord;
  readonly context: KnowledgeVersionContext;
}

export interface PublishVersionInput {
  readonly token: string;
  readonly reason?: string;
}

export interface ArchiveVersionInput {
  readonly token: string;
  readonly reason?: string;
}

export interface RestoreVersionInput {
  readonly token: string;
  readonly reason?: string;
}

export interface RollbackVersionInput {
  readonly token: string;
  readonly targetVersionId: string;
  readonly reason?: string;
}

export interface RollbackVersionResult {
  readonly version: KnowledgeVersion;
  readonly rollback: KnowledgeRollback;
}

export interface MergeVersionInput {
  readonly token: string;
  readonly targetVersionId: string;
  readonly strategy?: string;
  readonly reason?: string;
}

export interface MergeVersionResult {
  readonly version: KnowledgeVersion;
  readonly merge: KnowledgeMerge;
}

export interface CompareVersionInput {
  readonly token: string;
  readonly rightVersionId: string;
  /** Opaque, caller-supplied comparison payload (e.g. from an external IKnowledgeComparisonEngine). Never computed by this package. */
  readonly result?: Readonly<Record<string, unknown>>;
}

export interface CompareVersionResult {
  readonly comparison: KnowledgeComparison;
}

export interface CloneVersionInput {
  readonly token: string;
  readonly newVersionId: string;
  readonly newVersionName?: string;
}

export interface ForkVersionInput {
  readonly token: string;
  readonly newVersionId: string;
  readonly branchId: string;
  readonly branchName: string;
  readonly branchType: KnowledgeBranchType;
}

export interface ForkVersionResult {
  readonly version: KnowledgeVersion;
  readonly branch: KnowledgeBranch;
}

export interface SnapshotVersionInput {
  readonly token: string;
  readonly name?: string;
  readonly reason?: string;
}

export interface SnapshotVersionResult {
  readonly snapshot: KnowledgeSnapshot;
}

export interface DestroyVersionInput {
  readonly token: string;
  readonly reason?: string;
}
