import type { KnowledgeAsset } from "../domain/knowledge-asset.js";
import {
  createKnowledgeVersion,
  type KnowledgeVersion,
  type KnowledgeSnapshot,
} from "../domain/knowledge-version.js";
import { VersionConflictException } from "../errors/version-conflict-exception.js";
import { KnowledgeRegistryBucket } from "../registry/knowledge-registry-bucket.js";
import type { KnowledgeRegistry } from "../registry/knowledge-registry.js";
import { generateId } from "../utils/id.js";

export interface KnowledgeVersionDiffEntry {
  readonly before: unknown;
  readonly after: unknown;
}

/**
 * "KNOWLEDGE VERSIONING: Semantic Version ... History. Rollback. Compare. Snapshot. Diff.
 * Branch. Merge. No storage implementation. Only contracts." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md).
 * Implements Semantic Version bump/compare and an in-memory Snapshot History (no
 * persistence backend, matching this package's "Persistence: None" convention
 * everywhere). `Branch`/`Merge` are declared vocabulary this Engine does not yet
 * implement — see README "Known Limitations".
 */
export class KnowledgeVersionEngine {
  private readonly historyByAsset = new Map<string, KnowledgeSnapshot[]>();

  constructor(private readonly registry: KnowledgeRegistry) {}

  bumpMajor(version: KnowledgeVersion): KnowledgeVersion {
    return createKnowledgeVersion({ major: version.major + 1, minor: 0, patch: 0 });
  }

  bumpMinor(version: KnowledgeVersion): KnowledgeVersion {
    return createKnowledgeVersion({ major: version.major, minor: version.minor + 1, patch: 0 });
  }

  bumpPatch(version: KnowledgeVersion): KnowledgeVersion {
    return createKnowledgeVersion({
      major: version.major,
      minor: version.minor,
      patch: version.patch + 1,
    });
  }

  /** `-1` if `a < b`, `1` if `a > b`, `0` if equal — compares Major, then Minor, then Patch. */
  compare(a: KnowledgeVersion, b: KnowledgeVersion): -1 | 0 | 1 {
    for (const key of ["major", "minor", "patch"] as const) {
      if (a[key] !== b[key]) {
        return a[key] > b[key] ? 1 : -1;
      }
    }
    return 0;
  }

  snapshot(asset: KnowledgeAsset): KnowledgeSnapshot {
    const snap: KnowledgeSnapshot = {
      id: generateId(),
      assetId: asset.id,
      version: asset.version,
      capturedAt: new Date().toISOString(),
      data: asset as unknown as Record<string, unknown>,
    };
    this.registry.register(KnowledgeRegistryBucket.VERSION, snap);
    const history = this.historyByAsset.get(asset.id) ?? [];
    history.push(snap);
    this.historyByAsset.set(asset.id, history);
    return snap;
  }

  history(assetId: string): readonly KnowledgeSnapshot[] {
    return this.historyByAsset.get(assetId) ?? [];
  }

  rollback(assetId: string, versionLabel: string): KnowledgeSnapshot {
    const snap = this.history(assetId).find((entry) => entry.version.label === versionLabel);
    if (!snap) {
      throw new VersionConflictException(
        `No Snapshot "${versionLabel}" exists in History for Asset "${assetId}"`,
      );
    }
    return snap;
  }

  /** A shallow, structural field-by-field Diff between two Snapshots' captured `data`. */
  diff(
    a: KnowledgeSnapshot,
    b: KnowledgeSnapshot,
  ): Readonly<Record<string, KnowledgeVersionDiffEntry>> {
    const keys = new Set([...Object.keys(a.data), ...Object.keys(b.data)]);
    const result: Record<string, KnowledgeVersionDiffEntry> = {};
    for (const key of keys) {
      if (JSON.stringify(a.data[key]) !== JSON.stringify(b.data[key])) {
        result[key] = { before: a.data[key], after: b.data[key] };
      }
    }
    return result;
  }
}
