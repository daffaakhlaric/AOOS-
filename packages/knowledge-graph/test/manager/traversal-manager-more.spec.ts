import { describe, expect, it } from "vitest";

import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { NodeNotFoundException } from "../../src/errors/node-not-found-exception.js";
import { KnowledgeGraphManager } from "../../src/manager/knowledge-graph-manager.js";
import { TraversalManager } from "../../src/manager/traversal-manager.js";
import { buildTestContext } from "../helpers/context-fixture.js";

function setup() {
  const ctx = buildTestContext();
  const graphManager = new KnowledgeGraphManager(ctx);
  const traversalManager = new TraversalManager(ctx, graphManager);
  return { ctx, graphManager, traversalManager };
}

describe("TraversalManager — further coverage", () => {
  it("breadthFirstSearch propagates NodeNotFoundException for a missing start node", () => {
    const { graphManager, traversalManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    expect(() => traversalManager.breadthFirstSearch(graph.id, "missing")).toThrow(
      NodeNotFoundException,
    );
  });

  it("depthFirstSearch propagates NodeNotFoundException for a missing start node", () => {
    const { graphManager, traversalManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    expect(() => traversalManager.depthFirstSearch(graph.id, "missing")).toThrow(
      NodeNotFoundException,
    );
  });

  it("shortestPath from a node to itself is a length-0 path", () => {
    const { graphManager, traversalManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const node = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const path = traversalManager.shortestPath(graph.id, node.id, node.id);
    expect(path).toEqual({ nodeIds: [node.id], edgeIds: [], length: 0 });
  });

  it("multiple traversal calls accumulate traversalCount and monitor samples", () => {
    const { ctx, graphManager, traversalManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const node = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    traversalManager.breadthFirstSearch(graph.id, node.id);
    traversalManager.depthFirstSearch(graph.id, node.id);
    expect(ctx.metricsCollector.snapshot().traversalCount).toBe(2);
    expect(ctx.monitor.performance().traversalSampleCount).toBe(2);
  });
});
