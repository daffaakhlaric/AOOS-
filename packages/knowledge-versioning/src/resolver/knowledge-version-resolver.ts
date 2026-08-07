import type { KnowledgeBranch } from "../domain/knowledge-branch.js";
import {
  knowledgeComparisonSchema,
  type KnowledgeComparison,
} from "../domain/knowledge-comparison.js";
import type { KnowledgeHistory } from "../domain/knowledge-history.js";
import type { KnowledgeLineage } from "../domain/knowledge-lineage.js";
import type { KnowledgeSnapshot } from "../domain/knowledge-snapshot.js";
import { VersionNotFoundException } from "../errors/version-not-found-exception.js";
import { KnowledgeVersionRegistryBucket } from "../registry/knowledge-version-registry-bucket.js";
import type { KnowledgeVersionRegistry } from "../registry/knowledge-version-registry.js";
import type { VersionRegistryEntry } from "../registry/version-registry-entry.js";

/**
 * "RESOLVER: Version Resolver, Snapshot Resolver, Branch Resolver, History Resolver,
 * Lineage Resolver, Comparison Resolver." (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md)
 * — the exact 6 resolution dimensions from the prompt, implemented as one class with a
 * resolve/tryResolve method pair per dimension (the single-class shape 005.7F/005.7G
 * established). Every resolve is a direct Registry bucket lookup by id — never a scan.
 * Judgment call: Comparison records live in the `METADATA` bucket (the prompt's 8-bucket
 * list has no Comparison bucket, and a comparison IS "Comparison metadata");
 * `resolveComparison` therefore schema-checks the entry it finds so a merge/rollback
 * metadata record under the same bucket can never masquerade as a comparison.
 */
export class KnowledgeVersionResolver {
  constructor(private readonly registry: KnowledgeVersionRegistry) {}

  resolveVersion(versionId: string): VersionRegistryEntry {
    const entry = this.tryResolveVersion(versionId);
    if (!entry) {
      throw new VersionNotFoundException(`No Version is registered for Version Id "${versionId}"`);
    }
    return entry;
  }

  tryResolveVersion(versionId: string): VersionRegistryEntry | undefined {
    return this.registry.get<VersionRegistryEntry>(
      KnowledgeVersionRegistryBucket.VERSION,
      versionId,
    );
  }

  resolveSnapshot(snapshotId: string): KnowledgeSnapshot {
    const entry = this.tryResolveSnapshot(snapshotId);
    if (!entry) {
      throw new VersionNotFoundException(
        `No Snapshot is registered for Snapshot Id "${snapshotId}"`,
      );
    }
    return entry;
  }

  tryResolveSnapshot(snapshotId: string): KnowledgeSnapshot | undefined {
    return this.registry.get<KnowledgeSnapshot>(
      KnowledgeVersionRegistryBucket.SNAPSHOT,
      snapshotId,
    );
  }

  resolveBranch(branchId: string): KnowledgeBranch {
    const entry = this.tryResolveBranch(branchId);
    if (!entry) {
      throw new VersionNotFoundException(`No Branch is registered for Branch Id "${branchId}"`);
    }
    return entry;
  }

  tryResolveBranch(branchId: string): KnowledgeBranch | undefined {
    return this.registry.get<KnowledgeBranch>(KnowledgeVersionRegistryBucket.BRANCH, branchId);
  }

  resolveHistory(versionId: string): KnowledgeHistory {
    const entry = this.tryResolveHistory(versionId);
    if (!entry) {
      throw new VersionNotFoundException(`No History is recorded for Version Id "${versionId}"`);
    }
    return entry;
  }

  tryResolveHistory(versionId: string): KnowledgeHistory | undefined {
    return this.registry.get<KnowledgeHistory>(KnowledgeVersionRegistryBucket.HISTORY, versionId);
  }

  resolveLineage(assetId: string): KnowledgeLineage {
    const entry = this.tryResolveLineage(assetId);
    if (!entry) {
      throw new VersionNotFoundException(`No Lineage is recorded for Asset Id "${assetId}"`);
    }
    return entry;
  }

  tryResolveLineage(assetId: string): KnowledgeLineage | undefined {
    return this.registry.get<KnowledgeLineage>(KnowledgeVersionRegistryBucket.LINEAGE, assetId);
  }

  resolveComparison(comparisonId: string): KnowledgeComparison {
    const entry = this.tryResolveComparison(comparisonId);
    if (!entry) {
      throw new VersionNotFoundException(
        `No Comparison is registered for Comparison Id "${comparisonId}"`,
      );
    }
    return entry;
  }

  tryResolveComparison(comparisonId: string): KnowledgeComparison | undefined {
    const entry = this.registry.get<unknown>(KnowledgeVersionRegistryBucket.METADATA, comparisonId);
    if (entry === undefined) {
      return undefined;
    }
    const parsed = knowledgeComparisonSchema.safeParse(entry);
    return parsed.success ? parsed.data : undefined;
  }
}
