import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { GraphEngine } from "../../src/graph/graph-engine.js";

/** Adds a node with a deterministic id (`label`) so fixtures read naturally in assertions. */
export function addNode(
  engine: GraphEngine,
  id: string,
  type: KnowledgeNodeType = KnowledgeNodeType.Knowledge,
): void {
  engine.addNode({
    id,
    type,
    label: id,
    metadata: {},
    createdAt: 0,
    updatedAt: 0,
  });
}

/** Adds an edge with a deterministic id (`${type}:${source}->${target}`). */
export function addEdge(
  engine: GraphEngine,
  sourceNodeId: string,
  targetNodeId: string,
  type: KnowledgeEdgeType = KnowledgeEdgeType.DependsOn,
  weight = 1,
): void {
  engine.addEdge({
    id: `${type}:${sourceNodeId}->${targetNodeId}`,
    type,
    sourceNodeId,
    targetNodeId,
    weight,
    metadata: {},
    createdAt: 0,
    updatedAt: 0,
  });
}

/**
 * A simple DAG: A -> B -> C -> D (DependsOn), plus A -> C directly (a shortcut edge) so shortest
 * path has two candidate routes of different lengths (A-B-C length 2 vs A-C length 1).
 *
 *        A
 *       / \
 *      B   |
 *       \ /
 *        C
 *        |
 *        D
 */
export function buildDagEngine(): GraphEngine {
  const engine = GraphEngine.create({ id: "dag-graph", name: "DAG Fixture" });
  addNode(engine, "A");
  addNode(engine, "B");
  addNode(engine, "C");
  addNode(engine, "D");
  addEdge(engine, "A", "B");
  addEdge(engine, "B", "C");
  addEdge(engine, "A", "C");
  addEdge(engine, "C", "D");
  return engine;
}

/**
 * A graph with 3 nodes in a chain (X -> Y -> Z via DependsOn) suitable for cycle-candidate tests:
 * adding a `Z -> X` `DependsOn` edge WOULD close a cycle; adding a `Z -> W` edge to a new node
 * would NOT.
 */
export function buildCycleCandidateEngine(): GraphEngine {
  const engine = GraphEngine.create({
    id: "cycle-candidate-graph",
    name: "Cycle Candidate Fixture",
  });
  addNode(engine, "X");
  addNode(engine, "Y");
  addNode(engine, "Z");
  addNode(engine, "W");
  addEdge(engine, "X", "Y");
  addEdge(engine, "Y", "Z");
  return engine;
}

/** A graph that already contains a cycle (P -> Q -> R -> P), for `detectCycles` assertions. */
export function buildGraphWithExistingCycle(): GraphEngine {
  const engine = GraphEngine.create({ id: "existing-cycle-graph", name: "Existing Cycle Fixture" });
  addNode(engine, "P");
  addNode(engine, "Q");
  addNode(engine, "R");
  addEdge(engine, "P", "Q");
  addEdge(engine, "Q", "R");
  addEdge(engine, "R", "P");
  return engine;
}

/**
 * 2 disjoint connected components — {M1, M2, M3} and {N1, N2} — plus one fully isolated node O.
 * `findConnectedComponents` should return exactly 3 clusters of size 3, 2, and 1.
 */
export function buildDisjointComponentsEngine(): GraphEngine {
  const engine = GraphEngine.create({ id: "disjoint-graph", name: "Disjoint Components Fixture" });
  addNode(engine, "M1");
  addNode(engine, "M2");
  addNode(engine, "M3");
  addNode(engine, "N1");
  addNode(engine, "N2");
  addNode(engine, "O");
  addEdge(engine, "M1", "M2", KnowledgeEdgeType.RelatedTo);
  addEdge(engine, "M2", "M3", KnowledgeEdgeType.RelatedTo);
  addEdge(engine, "N1", "N2", KnowledgeEdgeType.RelatedTo);
  return engine;
}

/**
 * Multiple paths of different lengths between `S` and `T`: a direct edge (length 1) and a
 * 3-hop detour through `H1`/`H2` (length 3). `shortestPath` must prefer the length-1 route.
 */
export function buildMultiPathEngine(): GraphEngine {
  const engine = GraphEngine.create({ id: "multipath-graph", name: "Multi Path Fixture" });
  addNode(engine, "S");
  addNode(engine, "H1");
  addNode(engine, "H2");
  addNode(engine, "T");
  addEdge(engine, "S", "H1", KnowledgeEdgeType.RelatedTo);
  addEdge(engine, "H1", "H2", KnowledgeEdgeType.RelatedTo);
  addEdge(engine, "H2", "T", KnowledgeEdgeType.RelatedTo);
  addEdge(engine, "S", "T", KnowledgeEdgeType.RelatedTo);
  return engine;
}
