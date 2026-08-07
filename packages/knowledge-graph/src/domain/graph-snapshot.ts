import type { KnowledgeEdge } from "./knowledge-edge.js";
import type { KnowledgeNode } from "./knowledge-node.js";

/** An immutable, point-in-time deep copy of a `KnowledgeGraph`'s nodes and edges. */
export interface GraphSnapshot {
  readonly id: string;
  readonly graphId: string;
  readonly version: number;
  readonly nodes: readonly KnowledgeNode[];
  readonly edges: readonly KnowledgeEdge[];
  readonly label?: string;
  readonly createdAt: number;
}
