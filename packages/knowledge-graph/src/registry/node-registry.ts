import type { KnowledgeNode } from "../domain/knowledge-node.js";
import { NodeNotFoundException } from "../errors/node-not-found-exception.js";

import { RegistryBucket } from "./registry-bucket.js";

/** A `KnowledgeNode` together with the id of the graph it currently belongs to. */
export interface NodeRegistryEntry {
  readonly graphId: string;
  readonly node: KnowledgeNode;
}

/**
 * Global, cross-graph, id-keyed index of every `KnowledgeNode` in the system. Lets callers resolve
 * "which graph is node X in, and what does it look like" in O(1) without scanning every
 * `GraphEngine` in the `GraphRegistry`. Kept in sync by `KnowledgeGraphManager` on every node
 * mutation (create/update/delete/move/copy).
 */
export class NodeRegistry {
  private readonly bucket = new RegistryBucket<NodeRegistryEntry>(
    "node",
    (id) => new NodeNotFoundException(id),
  );

  register(graphId: string, node: KnowledgeNode): NodeRegistryEntry {
    return this.bucket.register(node.id, { graphId, node });
  }

  put(graphId: string, node: KnowledgeNode): NodeRegistryEntry {
    return this.bucket.put(node.id, { graphId, node });
  }

  get(nodeId: string): NodeRegistryEntry {
    return this.bucket.get(nodeId);
  }

  tryGet(nodeId: string): NodeRegistryEntry | undefined {
    return this.bucket.tryGet(nodeId);
  }

  has(nodeId: string): boolean {
    return this.bucket.has(nodeId);
  }

  remove(nodeId: string): boolean {
    return this.bucket.remove(nodeId);
  }

  list(): NodeRegistryEntry[] {
    return this.bucket.list();
  }

  get size(): number {
    return this.bucket.size;
  }

  clear(): void {
    this.bucket.clear();
  }
}
