import { GraphEngine } from "./graph-engine.js";

/**
 * Extracts an induced sub-graph containing exactly `nodeIds` and every edge from the source graph
 * whose source AND target both fall within `nodeIds`. Missing node ids are silently skipped.
 */
export function extractSubGraph(
  source: GraphEngine,
  nodeIds: readonly string[],
  name: string,
): GraphEngine {
  const subGraph = GraphEngine.create({ name });
  const nodeIdSet = new Set(nodeIds);

  for (const nodeId of nodeIds) {
    const node = source.tryGetNode(nodeId);
    if (node) subGraph.addNode({ ...node });
  }

  for (const edge of source.listEdges()) {
    if (nodeIdSet.has(edge.sourceNodeId) && nodeIdSet.has(edge.targetNodeId)) {
      if (subGraph.hasNode(edge.sourceNodeId) && subGraph.hasNode(edge.targetNodeId)) {
        subGraph.addEdge({ ...edge });
      }
    }
  }

  return subGraph;
}
