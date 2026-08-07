import type { GraphEngine } from "./graph-engine.js";

export interface GraphValidationIssue {
  readonly kind: "dangling-edge-source" | "dangling-edge-target" | "self-loop";
  readonly edgeId?: string;
  readonly nodeId?: string;
  readonly message: string;
}

export interface GraphValidationReport {
  readonly graphId: string;
  readonly valid: boolean;
  readonly issues: readonly GraphValidationIssue[];
  readonly validatedAt: number;
}

/**
 * Real structural validation of a graph: every edge must reference two nodes that exist in the
 * same graph, and edges must not be self-loops (source/target are already prevented at edge
 * creation time, but a graph can theoretically be assembled by other means — e.g. Restore Graph
 * from an externally-modified snapshot — so validation re-checks the invariant).
 */
export function validateGraph(engine: GraphEngine): GraphValidationReport {
  const issues: GraphValidationIssue[] = [];

  for (const edge of engine.listEdges()) {
    if (!engine.hasNode(edge.sourceNodeId)) {
      issues.push({
        kind: "dangling-edge-source",
        edgeId: edge.id,
        nodeId: edge.sourceNodeId,
        message: `Edge ${edge.id} references missing source node ${edge.sourceNodeId}`,
      });
    }
    if (!engine.hasNode(edge.targetNodeId)) {
      issues.push({
        kind: "dangling-edge-target",
        edgeId: edge.id,
        nodeId: edge.targetNodeId,
        message: `Edge ${edge.id} references missing target node ${edge.targetNodeId}`,
      });
    }
    if (edge.sourceNodeId === edge.targetNodeId) {
      issues.push({
        kind: "self-loop",
        edgeId: edge.id,
        nodeId: edge.sourceNodeId,
        message: `Edge ${edge.id} is a self-loop on node ${edge.sourceNodeId}`,
      });
    }
  }

  return {
    graphId: engine.graph.id,
    valid: issues.length === 0,
    issues,
    validatedAt: Date.now(),
  };
}
