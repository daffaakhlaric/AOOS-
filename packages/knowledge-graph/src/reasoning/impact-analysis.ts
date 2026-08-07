import type { GraphEngine } from "../graph/graph-engine.js";

import { findDependents } from "./dependency-reasoner.js";

export interface ImpactAnalysisResult {
  readonly nodeId: string;
  readonly impactedNodeIds: readonly string[];
  readonly impactedCount: number;
}

/**
 * Impact analysis: if `nodeId` changes, which nodes are affected? Defined as `nodeId`'s full
 * transitive dependent set (every node reachable by walking `DependsOn`/`Uses`/`Calls`/
 * `References` edges backwards from `nodeId`) — i.e. `findDependents`, exposed here as its own
 * reasoning operation because Impact Analysis is a first-class Graph Operation in the spec.
 */
export function analyzeImpact(engine: GraphEngine, nodeId: string): ImpactAnalysisResult {
  const impactedNodeIds = findDependents(engine, nodeId);
  return { nodeId, impactedNodeIds, impactedCount: impactedNodeIds.length };
}
