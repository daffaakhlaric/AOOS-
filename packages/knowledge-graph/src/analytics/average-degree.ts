import type { GraphEngine } from "../graph/graph-engine.js";

/**
 * Average degree formula: `(edgeCount * 2) / nodeCount`. Each directed edge contributes one to
 * its source's out-degree and one to its target's in-degree, so the sum of all degrees is exactly
 * `edgeCount * 2` regardless of direction — dividing by node count gives the mean total degree
 * per node. Returns 0 for an empty graph (avoids division by zero).
 */
export function computeAverageDegree(engine: GraphEngine): number {
  const nodeCount = engine.listNodes().length;
  if (nodeCount === 0) return 0;
  const edgeCount = engine.listEdges().length;
  return (edgeCount * 2) / nodeCount;
}
