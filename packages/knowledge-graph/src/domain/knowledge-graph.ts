import type { KnowledgeEdge } from "./knowledge-edge.js";
import type { KnowledgeNode } from "./knowledge-node.js";

/**
 * The `KnowledgeGraph` aggregate: a named, in-memory collection of `KnowledgeNode`s and
 * `KnowledgeEdge`s. Nodes/edges are stored as mutable `Map`s so the graph engine (`src/graph/`)
 * can perform O(1) id-keyed CRUD; traversal algorithms build their own adjacency indexes on top.
 */
export interface KnowledgeGraph {
  readonly id: string;
  name: string;
  description?: string;
  readonly nodes: Map<string, KnowledgeNode>;
  readonly edges: Map<string, KnowledgeEdge>;
  readonly createdAt: number;
  updatedAt: number;
  version: number;
}

/** Fields a caller supplies to create a `KnowledgeGraph`. */
export interface CreateKnowledgeGraphInput {
  readonly id?: string;
  readonly name: string;
  readonly description?: string;
}
