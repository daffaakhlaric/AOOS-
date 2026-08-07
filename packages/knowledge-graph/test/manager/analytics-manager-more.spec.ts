import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { AnalyticsManager } from "../../src/manager/analytics-manager.js";
import { KnowledgeGraphManager } from "../../src/manager/knowledge-graph-manager.js";
import { buildTestContext } from "../helpers/context-fixture.js";

function setup() {
  const ctx = buildTestContext();
  const graphManager = new KnowledgeGraphManager(ctx);
  const analyticsManager = new AnalyticsManager(ctx);
  return { ctx, graphManager, analyticsManager };
}

describe("AnalyticsManager — further coverage", () => {
  it("connectedComponents on an empty graph returns an empty array and a 0 gauge", () => {
    const { ctx, graphManager, analyticsManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    expect(analyticsManager.connectedComponents(graph.id)).toEqual([]);
    expect(ctx.metricsCollector.snapshot().connectedComponents).toBe(0);
  });

  it("cycleDetection with an explicit edgeTypes array narrower than the actual cycle finds nothing", () => {
    const { graphManager, analyticsManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const a = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    graphManager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: a.id,
      targetNodeId: b.id,
    });
    graphManager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: b.id,
      targetNodeId: a.id,
    });
    expect(analyticsManager.cycleDetection(graph.id, [KnowledgeEdgeType.Owns]).hasCycle).toBe(
      false,
    );
  });

  it("averageDegree reflects the current edge/node ratio after mutation", () => {
    const { graphManager, analyticsManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const a = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    graphManager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: a.id,
      targetNodeId: b.id,
    });
    expect(analyticsManager.averageDegree(graph.id)).toBe(1);
  });

  it("graphValidation flags issues after the graph is corrupted directly on the engine", () => {
    const { ctx, graphManager, analyticsManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    ctx.graphRegistry.get(graph.id).graph.edges.set("dangling", {
      id: "dangling",
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: "missing",
      targetNodeId: "missing2",
      weight: 1,
      metadata: {},
      createdAt: 0,
      updatedAt: 0,
    });
    const report = analyticsManager.graphValidation(graph.id);
    expect(report.valid).toBe(false);
  });
});
