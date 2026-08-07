import type { KnowledgeEdge } from "../domain/knowledge-edge.js";
import { EdgeNotFoundException } from "../errors/edge-not-found-exception.js";

import { RegistryBucket } from "./registry-bucket.js";

/** A `KnowledgeEdge` together with the id of the graph it currently belongs to. */
export interface EdgeRegistryEntry {
  readonly graphId: string;
  readonly edge: KnowledgeEdge;
}

/**
 * Global, cross-graph, id-keyed index of every `KnowledgeEdge` in the system, mirroring
 * `NodeRegistry`'s purpose for edges. Kept in sync by `KnowledgeGraphManager`/`RelationshipManager`
 * on every edge mutation.
 */
export class EdgeRegistry {
  private readonly bucket = new RegistryBucket<EdgeRegistryEntry>(
    "edge",
    (id) => new EdgeNotFoundException(id),
  );

  register(graphId: string, edge: KnowledgeEdge): EdgeRegistryEntry {
    return this.bucket.register(edge.id, { graphId, edge });
  }

  put(graphId: string, edge: KnowledgeEdge): EdgeRegistryEntry {
    return this.bucket.put(edge.id, { graphId, edge });
  }

  get(edgeId: string): EdgeRegistryEntry {
    return this.bucket.get(edgeId);
  }

  tryGet(edgeId: string): EdgeRegistryEntry | undefined {
    return this.bucket.tryGet(edgeId);
  }

  has(edgeId: string): boolean {
    return this.bucket.has(edgeId);
  }

  remove(edgeId: string): boolean {
    return this.bucket.remove(edgeId);
  }

  list(): EdgeRegistryEntry[] {
    return this.bucket.list();
  }

  get size(): number {
    return this.bucket.size;
  }

  clear(): void {
    this.bucket.clear();
  }
}
