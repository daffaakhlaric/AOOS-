import type { KnowledgeNode } from "../domain/knowledge-node.js";
import { now } from "../utils/index.js";

import type { GraphEngine } from "./graph-engine.js";

/**
 * Conflict-resolution strategy for `mergeGraphs` when both graphs contain a node with the same id.
 * - `"keep-target"` (default): the target graph's node wins, source node is discarded.
 * - `"keep-source"`: the source graph's node overwrites the target's node.
 * - `"merge-metadata"`: keeps the target node's identity/label but shallow-merges metadata,
 *   preferring source values on key collision, and bumps `updatedAt`.
 */
export type GraphMergeConflictResolution = "keep-target" | "keep-source" | "merge-metadata";

export interface GraphMergeResult {
  readonly mergedNodeCount: number;
  readonly mergedEdgeCount: number;
  readonly conflictedNodeIds: readonly string[];
}

function resolveConflict(
  targetNode: KnowledgeNode,
  sourceNode: KnowledgeNode,
  resolution: GraphMergeConflictResolution,
): KnowledgeNode {
  if (resolution === "keep-target") return targetNode;
  if (resolution === "keep-source") return sourceNode;
  return {
    ...targetNode,
    metadata: { ...targetNode.metadata, ...sourceNode.metadata },
    updatedAt: now(),
  };
}

/**
 * Merges `source`'s nodes and edges into `target` in place (real union, not a stub). Node id
 * collisions are resolved per `resolution`. Edges are only added when the id is not already
 * present in `target` AND no functionally-identical edge (same type/source/target) already
 * exists, so re-merging is idempotent.
 */
export function mergeGraphs(
  target: GraphEngine,
  source: GraphEngine,
  resolution: GraphMergeConflictResolution = "keep-target",
): GraphMergeResult {
  const conflictedNodeIds: string[] = [];
  let mergedNodeCount = 0;
  let mergedEdgeCount = 0;

  for (const sourceNode of source.listNodes()) {
    if (target.hasNode(sourceNode.id)) {
      conflictedNodeIds.push(sourceNode.id);
      const targetNode = target.getNode(sourceNode.id);
      target.replaceNode(resolveConflict(targetNode, sourceNode, resolution));
      continue;
    }
    target.addNode({ ...sourceNode });
    mergedNodeCount += 1;
  }

  const existingFunctionalKeys = new Set(
    target.listEdges().map((edge) => `${edge.type}:${edge.sourceNodeId}:${edge.targetNodeId}`),
  );

  for (const sourceEdge of source.listEdges()) {
    const functionalKey = `${sourceEdge.type}:${sourceEdge.sourceNodeId}:${sourceEdge.targetNodeId}`;
    if (target.hasEdge(sourceEdge.id) || existingFunctionalKeys.has(functionalKey)) {
      continue;
    }
    target.addEdge({ ...sourceEdge });
    existingFunctionalKeys.add(functionalKey);
    mergedEdgeCount += 1;
  }

  return { mergedNodeCount, mergedEdgeCount, conflictedNodeIds };
}
