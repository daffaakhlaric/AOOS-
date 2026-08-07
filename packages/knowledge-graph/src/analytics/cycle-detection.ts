import type { KnowledgeEdgeType } from "../domain/knowledge-edge-type.js";
import type { GraphEngine } from "../graph/graph-engine.js";

export interface CycleDetectionResult {
  readonly hasCycle: boolean;
  readonly cycleCount: number;
  readonly cycles: readonly (readonly string[])[];
}

const WHITE = 0;
const GRAY = 1;
const BLACK = 2;

/**
 * Real cycle detection via DFS with recursion-stack coloring (white/gray/black). Runs over the
 * subgraph induced by `edgeTypes` (or the whole graph when omitted). Each back-edge to a GRAY node
 * is reported as one cycle (the recursion-stack slice from that node back to itself).
 * `O(V + E)` on the filtered subgraph.
 */
export function detectCycles(
  engine: GraphEngine,
  edgeTypes?: ReadonlySet<KnowledgeEdgeType>,
): CycleDetectionResult {
  const color = new Map<string, number>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  const visit = (nodeId: string): void => {
    color.set(nodeId, GRAY);
    stack.push(nodeId);
    for (const neighborId of engine.outgoingNeighborIds(nodeId, edgeTypes as ReadonlySet<string>)) {
      const state = color.get(neighborId) ?? WHITE;
      if (state === WHITE) {
        visit(neighborId);
      } else if (state === GRAY) {
        const cycleStart = stack.indexOf(neighborId);
        cycles.push([...stack.slice(cycleStart), neighborId]);
      }
    }
    stack.pop();
    color.set(nodeId, BLACK);
  };

  for (const node of engine.listNodes()) {
    if ((color.get(node.id) ?? WHITE) === WHITE) {
      visit(node.id);
    }
  }

  return { hasCycle: cycles.length > 0, cycleCount: cycles.length, cycles };
}

/**
 * Would adding a `sourceNodeId -> targetNodeId` edge (restricted to `edgeTypes`) introduce a
 * cycle? True iff `targetNodeId` can already reach `sourceNodeId` via existing edges of those
 * types — reachability is checked with a plain BFS, `O(V + E)`.
 */
export function wouldCreateCycle(
  engine: GraphEngine,
  sourceNodeId: string,
  targetNodeId: string,
  edgeTypes: ReadonlySet<KnowledgeEdgeType>,
): boolean {
  if (sourceNodeId === targetNodeId) return true;
  const visited = new Set<string>([targetNodeId]);
  const queue = [targetNodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighborId of engine.outgoingNeighborIds(
      current,
      edgeTypes as ReadonlySet<string>,
    )) {
      if (neighborId === sourceNodeId) return true;
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }
  return false;
}
