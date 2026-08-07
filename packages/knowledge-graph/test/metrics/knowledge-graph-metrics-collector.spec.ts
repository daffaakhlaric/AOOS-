import { describe, expect, it } from "vitest";

import { KnowledgeGraphMetricsCollector } from "../../src/metrics/knowledge-graph-metrics-collector.js";

describe("KnowledgeGraphMetricsCollector", () => {
  it("starts at all-zero counters", () => {
    const collector = new KnowledgeGraphMetricsCollector();
    expect(collector.snapshot()).toMatchObject({
      graphCount: 0,
      nodeCount: 0,
      edgeCount: 0,
      relationshipCount: 0,
      traversalCount: 0,
      averageDegree: 0,
      connectedComponents: 0,
      cycleCount: 0,
    });
  });

  it("increments/decrements graphCount", () => {
    const collector = new KnowledgeGraphMetricsCollector();
    collector.recordGraphCreated();
    collector.recordGraphCreated();
    collector.recordGraphDeleted();
    expect(collector.snapshot().graphCount).toBe(1);
  });

  it("graphCount never goes negative", () => {
    const collector = new KnowledgeGraphMetricsCollector();
    collector.recordGraphDeleted();
    expect(collector.snapshot().graphCount).toBe(0);
  });

  it("increments/decrements nodeCount", () => {
    const collector = new KnowledgeGraphMetricsCollector();
    collector.recordNodeCreated();
    collector.recordNodeDeleted();
    collector.recordNodeDeleted();
    expect(collector.snapshot().nodeCount).toBe(0);
  });

  it("edgeCount and relationshipCount move together", () => {
    const collector = new KnowledgeGraphMetricsCollector();
    collector.recordEdgeCreated();
    collector.recordEdgeCreated();
    collector.recordEdgeDeleted();
    expect(collector.snapshot().edgeCount).toBe(1);
    expect(collector.snapshot().relationshipCount).toBe(1);
  });

  it("records traversal count", () => {
    const collector = new KnowledgeGraphMetricsCollector();
    collector.recordTraversal();
    collector.recordTraversal();
    expect(collector.snapshot().traversalCount).toBe(2);
  });

  it("records cycle detections", () => {
    const collector = new KnowledgeGraphMetricsCollector();
    collector.recordCycleDetected();
    expect(collector.snapshot().cycleCount).toBe(1);
  });

  it("setAverageDegree/setConnectedComponents update gauges", () => {
    const collector = new KnowledgeGraphMetricsCollector();
    collector.setAverageDegree(2.5);
    collector.setConnectedComponents(3);
    const snapshot = collector.snapshot();
    expect(snapshot.averageDegree).toBe(2.5);
    expect(snapshot.connectedComponents).toBe(3);
  });

  it("snapshot() includes a capturedAt timestamp", () => {
    const collector = new KnowledgeGraphMetricsCollector();
    expect(typeof collector.snapshot().capturedAt).toBe("number");
  });

  it("reset() zeroes every counter and gauge", () => {
    const collector = new KnowledgeGraphMetricsCollector();
    collector.recordGraphCreated();
    collector.recordNodeCreated();
    collector.recordEdgeCreated();
    collector.recordTraversal();
    collector.recordCycleDetected();
    collector.setAverageDegree(4);
    collector.setConnectedComponents(2);
    collector.reset();
    expect(collector.snapshot()).toMatchObject({
      graphCount: 0,
      nodeCount: 0,
      edgeCount: 0,
      relationshipCount: 0,
      traversalCount: 0,
      averageDegree: 0,
      connectedComponents: 0,
      cycleCount: 0,
    });
  });
});
