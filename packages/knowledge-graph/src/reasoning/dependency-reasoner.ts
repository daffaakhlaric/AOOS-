import { DEPENDENCY_EDGE_TYPES } from "../edges/edge-type-semantics.js";
import type { GraphEngine } from "../graph/graph-engine.js";
import { findAncestors, findDescendants } from "../traversal/find-ancestors-descendants.js";

/**
 * All transitive dependencies of `nodeId`: nodes reachable by following outgoing `DependsOn`,
 * `Uses`, `Calls`, or `References` edges (the direction convention is "source depends on target").
 */
export function findDependencies(engine: GraphEngine, nodeId: string): string[] {
  return findDescendants(engine, nodeId, Array.from(DEPENDENCY_EDGE_TYPES));
}

/**
 * All transitive dependents of `nodeId`: nodes that (directly or indirectly) depend on it, found
 * by walking the dependency-edge family backwards (incoming direction).
 */
export function findDependents(engine: GraphEngine, nodeId: string): string[] {
  return findAncestors(engine, nodeId, Array.from(DEPENDENCY_EDGE_TYPES));
}
