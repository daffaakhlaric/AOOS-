import type { KnowledgeEdgeType } from "./knowledge-edge-type.js";

/** The recorded result of a single Breadth-First or Depth-First traversal execution. */
export interface GraphTraversal {
  readonly algorithm: "bfs" | "dfs";
  readonly startNodeId: string;
  readonly visitedOrder: readonly string[];
  readonly edgeTypes?: readonly KnowledgeEdgeType[];
  readonly maxDepth?: number;
  readonly durationMs: number;
}
