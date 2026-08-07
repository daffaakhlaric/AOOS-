import type { GraphSnapshot } from "../domain/graph-snapshot.js";
import type { GraphEngine } from "../graph/graph-engine.js";
import { deepClone, generateId, now } from "../utils/index.js";

/**
 * Builds an immutable `GraphSnapshot` (a deep-cloned point-in-time copy of a graph's nodes/edges)
 * from a live `GraphEngine`. Deep-cloning here (rather than storing live references) is what makes
 * Restore Graph safe: subsequent mutation of the live graph can never retroactively corrupt an
 * already-taken snapshot.
 */
export class GraphSnapshotFactory {
  create(engine: GraphEngine, label?: string): GraphSnapshot {
    return {
      id: generateId("snapshot"),
      graphId: engine.graph.id,
      version: engine.graph.version,
      nodes: deepClone(engine.listNodes()),
      edges: deepClone(engine.listEdges()),
      label,
      createdAt: now(),
    };
  }
}
