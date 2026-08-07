import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { KnowledgeGraphManager } from "../../src/manager/knowledge-graph-manager.js";
import { buildTestContext } from "../helpers/context-fixture.js";

describe("KnowledgeGraphMetricsCollector — through the manager layer", () => {
  it("graphCount/nodeCount/edgeCount/relationshipCount all move together through a full lifecycle", () => {
    const ctx = buildTestContext();
    const manager = new KnowledgeGraphManager(ctx);
    const graph = manager.createGraph({ name: "G1" });
    const a = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    const edge = manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: a.id,
      targetNodeId: b.id,
    });

    let snapshot = ctx.metricsCollector.snapshot();
    expect(snapshot).toMatchObject({
      graphCount: 1,
      nodeCount: 2,
      edgeCount: 1,
      relationshipCount: 1,
    });

    manager.deleteEdge(graph.id, edge.id);
    snapshot = ctx.metricsCollector.snapshot();
    expect(snapshot).toMatchObject({ edgeCount: 0, relationshipCount: 0 });

    manager.deleteNode(graph.id, a.id);
    snapshot = ctx.metricsCollector.snapshot();
    expect(snapshot.nodeCount).toBe(1);

    manager.deleteGraph(graph.id);
    snapshot = ctx.metricsCollector.snapshot();
    expect(snapshot.graphCount).toBe(0);
  });

  it("deleting a node cascades edge deletion, and the Metrics stage decrements edgeCount for each cascaded edge too", () => {
    const ctx = buildTestContext();
    const manager = new KnowledgeGraphManager(ctx);
    const graph = manager.createGraph({ name: "G1" });
    const a = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: a.id,
      targetNodeId: b.id,
    });
    manager.deleteNode(graph.id, a.id);
    const snapshot = ctx.metricsCollector.snapshot();
    expect(snapshot.nodeCount).toBe(1);
    expect(snapshot.edgeCount).toBe(0);
    expect(snapshot.relationshipCount).toBe(0);
  });

  it("moving a node cascades edge deletion out of the metrics gauges too", () => {
    const ctx = buildTestContext();
    const manager = new KnowledgeGraphManager(ctx);
    const fromGraph = manager.createGraph({ name: "From" });
    const toGraph = manager.createGraph({ name: "To" });
    const a = manager.createNode(fromGraph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = manager.createNode(fromGraph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    manager.createEdge(fromGraph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: a.id,
      targetNodeId: b.id,
    });
    manager.moveNode(a.id, fromGraph.id, toGraph.id);
    expect(ctx.metricsCollector.snapshot().edgeCount).toBe(0);
  });
});
