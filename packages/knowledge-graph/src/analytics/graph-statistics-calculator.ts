import type { GraphStatistics } from "../domain/graph-statistics.js";
import type { GraphEngine } from "../graph/graph-engine.js";

import { computeAverageDegree } from "./average-degree.js";
import { findConnectedComponents } from "./connected-components.js";
import { detectCycles } from "./cycle-detection.js";

/** Computes a full `GraphStatistics` snapshot for a graph: counts, degree, components, cycles, breakdowns. */
export function calculateGraphStatistics(engine: GraphEngine): GraphStatistics {
  const nodes = engine.listNodes();
  const edges = engine.listEdges();

  const nodeTypeBreakdown: Record<string, number> = {};
  for (const node of nodes) {
    nodeTypeBreakdown[node.type] = (nodeTypeBreakdown[node.type] ?? 0) + 1;
  }

  const edgeTypeBreakdown: Record<string, number> = {};
  for (const edge of edges) {
    edgeTypeBreakdown[edge.type] = (edgeTypeBreakdown[edge.type] ?? 0) + 1;
  }

  return {
    graphId: engine.graph.id,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    averageDegree: computeAverageDegree(engine),
    connectedComponentCount: findConnectedComponents(engine).length,
    cycleCount: detectCycles(engine).cycleCount,
    nodeTypeBreakdown,
    edgeTypeBreakdown,
    computedAt: Date.now(),
  };
}
