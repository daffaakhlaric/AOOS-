import type { GraphRelationship } from "../domain/graph-relationship.js";
import { EdgeNotFoundException } from "../errors/edge-not-found-exception.js";

import { RegistryBucket } from "./registry-bucket.js";

/**
 * Global, cross-graph, id-keyed index of every materialized `GraphRelationship` (the
 * value-object view of an edge), keyed by the same id as its backing edge. Kept in sync by
 * `RelationshipManager` alongside `EdgeRegistry` so relationship-level lookups never need to
 * re-derive the projection or scan a graph's edge list.
 */
export class RelationshipRegistry {
  private readonly bucket = new RegistryBucket<GraphRelationship>(
    "relationship",
    (id) => new EdgeNotFoundException(id),
  );

  register(relationship: GraphRelationship): GraphRelationship {
    return this.bucket.register(relationship.edgeId, relationship);
  }

  put(relationship: GraphRelationship): GraphRelationship {
    return this.bucket.put(relationship.edgeId, relationship);
  }

  get(edgeId: string): GraphRelationship {
    return this.bucket.get(edgeId);
  }

  tryGet(edgeId: string): GraphRelationship | undefined {
    return this.bucket.tryGet(edgeId);
  }

  has(edgeId: string): boolean {
    return this.bucket.has(edgeId);
  }

  remove(edgeId: string): boolean {
    return this.bucket.remove(edgeId);
  }

  list(): GraphRelationship[] {
    return this.bucket.list();
  }

  get size(): number {
    return this.bucket.size;
  }

  clear(): void {
    this.bucket.clear();
  }
}
