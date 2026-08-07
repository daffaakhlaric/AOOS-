import { VersionLineageException } from "../errors/version-lineage-exception.js";

export interface KnowledgeLineageEdge {
  readonly parentVersionId: string;
  readonly childVersionId: string;
  readonly recordedAt: string;
}

/**
 * "KnowledgeLineage" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Domain Model") — the
 * parent/child version-derivation graph for one Knowledge Asset. `id` mirrors `assetId`
 * so the aggregate satisfies the Registry's `Identified` constraint and lives in the
 * `LINEAGE` bucket. Ancestry queries walk the recorded edges only — pure metadata, no
 * diff engine, cycle-safe via a visited set.
 */
export class KnowledgeLineage {
  readonly id: string;
  private readonly recordedEdges: KnowledgeLineageEdge[] = [];
  private readonly childrenByParent = new Map<string, Set<string>>();
  private readonly parentsByChild = new Map<string, Set<string>>();

  constructor(readonly assetId: string) {
    this.id = assetId;
  }

  addEdge(parentVersionId: string, childVersionId: string): KnowledgeLineageEdge {
    if (parentVersionId === childVersionId) {
      throw new VersionLineageException(
        `Lineage for Asset "${this.assetId}" rejects a self-edge on Version "${parentVersionId}"`,
      );
    }
    if (this.childrenByParent.get(parentVersionId)?.has(childVersionId)) {
      throw new VersionLineageException(
        `Lineage for Asset "${this.assetId}" already records edge "${parentVersionId}" -> "${childVersionId}"`,
      );
    }
    const edge: KnowledgeLineageEdge = {
      parentVersionId,
      childVersionId,
      recordedAt: new Date().toISOString(),
    };
    this.recordedEdges.push(edge);
    this.index(this.childrenByParent, parentVersionId, childVersionId);
    this.index(this.parentsByChild, childVersionId, parentVersionId);
    return edge;
  }

  edges(): readonly KnowledgeLineageEdge[] {
    return [...this.recordedEdges];
  }

  parentsOf(versionId: string): readonly string[] {
    return Array.from(this.parentsByChild.get(versionId) ?? []);
  }

  childrenOf(versionId: string): readonly string[] {
    return Array.from(this.childrenByParent.get(versionId) ?? []);
  }

  ancestorsOf(versionId: string): readonly string[] {
    return this.walk(versionId, (id) => this.parentsOf(id));
  }

  descendantsOf(versionId: string): readonly string[] {
    return this.walk(versionId, (id) => this.childrenOf(id));
  }

  private walk(start: string, next: (id: string) => readonly string[]): readonly string[] {
    const visited = new Set<string>();
    const queue = [...next(start)];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      queue.push(...next(current));
    }
    visited.delete(start);
    return Array.from(visited);
  }

  private index(mapping: Map<string, Set<string>>, key: string, value: string): void {
    const existing = mapping.get(key);
    if (existing) {
      existing.add(value);
      return;
    }
    mapping.set(key, new Set([value]));
  }
}
