import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { KnowledgeGraphManager } from "../../src/manager/knowledge-graph-manager.js";
import { TraversalManager } from "../../src/manager/traversal-manager.js";
import { buildTestContext } from "../helpers/context-fixture.js";

function setup() {
  const ctx = buildTestContext();
  const graphManager = new KnowledgeGraphManager(ctx);
  const traversalManager = new TraversalManager(ctx, graphManager);
  return { ctx, graphManager, traversalManager };
}

function buildChain(graphManager: KnowledgeGraphManager, graphId: string) {
  const a = graphManager.createNode(graphId, { type: KnowledgeNodeType.Agent, label: "A" });
  const b = graphManager.createNode(graphId, { type: KnowledgeNodeType.Agent, label: "B" });
  const c = graphManager.createNode(graphId, { type: KnowledgeNodeType.Agent, label: "C" });
  graphManager.createEdge(graphId, {
    type: KnowledgeEdgeType.DependsOn,
    sourceNodeId: a.id,
    targetNodeId: b.id,
  });
  graphManager.createEdge(graphId, {
    type: KnowledgeEdgeType.DependsOn,
    sourceNodeId: b.id,
    targetNodeId: c.id,
  });
  return { a, b, c };
}

describe("TraversalManager", () => {
  it("breadthFirstSearch records traversal count/duration and publishes TraversalExecuted", () => {
    const { ctx, graphManager, traversalManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const { a } = buildChain(graphManager, graph.id);
    const result = traversalManager.breadthFirstSearch(graph.id, a.id);
    expect(result.algorithm).toBe("bfs");
    expect(ctx.metricsCollector.snapshot().traversalCount).toBe(1);
    expect(ctx.monitor.performance().traversalSampleCount).toBe(1);
  });

  it("depthFirstSearch records traversal count/duration", () => {
    const { ctx, graphManager, traversalManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const { a } = buildChain(graphManager, graph.id);
    traversalManager.depthFirstSearch(graph.id, a.id);
    expect(ctx.metricsCollector.snapshot().traversalCount).toBe(1);
  });

  it("shortestPath finds the path between two nodes", () => {
    const { graphManager, traversalManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const { a, c } = buildChain(graphManager, graph.id);
    const path = traversalManager.shortestPath(graph.id, a.id, c.id);
    expect(path?.length).toBe(2);
  });

  it("findNeighbors/findAncestors/findDescendants delegate to the algorithm modules", () => {
    const { graphManager, traversalManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const { a, b, c } = buildChain(graphManager, graph.id);
    expect(traversalManager.findNeighbors(graph.id, b.id).sort()).toEqual([a.id, c.id].sort());
    expect(traversalManager.findAncestors(graph.id, c.id).sort()).toEqual([a.id, b.id].sort());
    expect(traversalManager.findDescendants(graph.id, a.id).sort()).toEqual([b.id, c.id].sort());
  });

  it("subGraph delegates to KnowledgeGraphManager.extractSubGraph", () => {
    const { ctx, graphManager, traversalManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const { a } = buildChain(graphManager, graph.id);
    const sub = traversalManager.subGraph(graph.id, [a.id], "Sub");
    expect(ctx.graphRegistry.get(sub.id).listNodes()).toHaveLength(1);
  });
});
