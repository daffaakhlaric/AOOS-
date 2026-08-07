import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import type { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { AnalyticsManager } from "../../src/manager/analytics-manager.js";
import { KnowledgeGraphManager } from "../../src/manager/knowledge-graph-manager.js";
import { buildTestContext } from "../helpers/context-fixture.js";

function setup() {
  const ctx = buildTestContext();
  const graphManager = new KnowledgeGraphManager(ctx);
  const analyticsManager = new AnalyticsManager(ctx);
  return { ctx, graphManager, analyticsManager };
}

describe("AnalyticsManager", () => {
  it("connectedComponents updates the metrics gauge", () => {
    const { ctx, graphManager, analyticsManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    const clusters = analyticsManager.connectedComponents(graph.id);
    expect(clusters).toHaveLength(2);
    expect(ctx.metricsCollector.snapshot().connectedComponents).toBe(2);
  });

  it("cycleDetection records a cycle-detected metric only when a cycle exists", () => {
    const { ctx, graphManager, analyticsManager } = setup();
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
    const result = analyticsManager.cycleDetection(graph.id);
    expect(result.hasCycle).toBe(true);
    expect(ctx.metricsCollector.snapshot().cycleCount).toBe(1);
  });

  it("cycleDetection accepts an explicit edge-type filter", () => {
    const { graphManager, analyticsManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const a = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    graphManager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: a.id,
      targetNodeId: b.id,
    });
    const result = analyticsManager.cycleDetection(graph.id, [KnowledgeEdgeType.DependsOn]);
    expect(result.hasCycle).toBe(false);
  });

  it("averageDegree updates the metrics gauge", () => {
    const { ctx, graphManager, analyticsManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const value = analyticsManager.averageDegree(graph.id);
    expect(value).toBe(0);
    expect(ctx.metricsCollector.snapshot().averageDegree).toBe(0);
  });

  it("graphValidation publishes GraphValidated", () => {
    const { ctx, graphManager, analyticsManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const report = analyticsManager.graphValidation(graph.id);
    expect(report.valid).toBe(true);
    expect((ctx.eventPublisher as InMemoryEventPublisher).getHistory().length).toBeGreaterThan(0);
  });

  it("graphStatistics computes and refreshes both gauges", () => {
    const { ctx, graphManager, analyticsManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    const stats = analyticsManager.graphStatistics(graph.id);
    expect(stats.nodeCount).toBe(2);
    expect(ctx.metricsCollector.snapshot().connectedComponents).toBe(stats.connectedComponentCount);
    expect(ctx.metricsCollector.snapshot().averageDegree).toBe(stats.averageDegree);
  });
});
