import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeGraphMetricsCollector } from "../../src/metrics/knowledge-graph-metrics-collector.js";
import { KnowledgeGraphMonitor } from "../../src/monitoring/knowledge-graph-monitor.js";
import { GraphRegistry } from "../../src/registry/graph-registry.js";
import { buildDagEngine } from "../helpers/graph-fixtures.js";

describe("KnowledgeGraphMonitor", () => {
  it("health() reports healthy with no issues for well-formed graphs", () => {
    const registry = new GraphRegistry();
    registry.register(buildDagEngine());
    const monitor = new KnowledgeGraphMonitor(registry, new KnowledgeGraphMetricsCollector());
    const report = monitor.health();
    expect(report.status).toBe("healthy");
    expect(report.graphCount).toBe(1);
    expect(report.issues).toEqual([]);
  });

  it("health() reports degraded when a registered graph fails structural validation", () => {
    const engine = buildDagEngine();
    engine.graph.edges.set("dangling", {
      id: "dangling",
      type: engine.getEdge("DependsOn:A->B").type,
      sourceNodeId: "does-not-exist",
      targetNodeId: "A",
      weight: 1,
      metadata: {},
      createdAt: 0,
      updatedAt: 0,
    });
    const registry = new GraphRegistry();
    registry.register(engine);
    const monitor = new KnowledgeGraphMonitor(registry, new KnowledgeGraphMetricsCollector());
    const report = monitor.health();
    expect(report.status).toBe("degraded");
    expect(report.issues.length).toBeGreaterThan(0);
  });

  it("performance()/traversalTime() average recorded traversal durations", () => {
    const registry = new GraphRegistry();
    const monitor = new KnowledgeGraphMonitor(registry, new KnowledgeGraphMetricsCollector());
    expect(monitor.performance()).toEqual({
      averageTraversalDurationMs: 0,
      traversalSampleCount: 0,
    });
    monitor.recordTraversalDuration(10);
    monitor.recordTraversalDuration(20);
    expect(monitor.performance()).toEqual({
      averageTraversalDurationMs: 15,
      traversalSampleCount: 2,
    });
    expect(monitor.traversalTime()).toBe(15);
  });

  it("memoryUsage() returns a non-negative number", () => {
    const registry = new GraphRegistry();
    const monitor = new KnowledgeGraphMonitor(registry, new KnowledgeGraphMetricsCollector());
    expect(monitor.memoryUsage()).toBeGreaterThanOrEqual(0);
  });

  describe("memoryUsage() without a global process object", () => {
    const originalProcess = globalThis.process;

    afterEach(() => {
      vi.stubGlobal("process", originalProcess);
    });

    it("falls back to 0", () => {
      vi.stubGlobal("process", undefined);
      const registry = new GraphRegistry();
      const monitor = new KnowledgeGraphMonitor(registry, new KnowledgeGraphMetricsCollector());
      expect(monitor.memoryUsage()).toBe(0);
    });
  });

  it("graphSize() reports node/edge counts for a specific graph", () => {
    const registry = new GraphRegistry();
    const engine = buildDagEngine();
    registry.register(engine);
    const monitor = new KnowledgeGraphMonitor(registry, new KnowledgeGraphMetricsCollector());
    expect(monitor.graphSize(engine.graph.id)).toEqual({
      graphId: engine.graph.id,
      nodeCount: 4,
      edgeCount: 4,
    });
  });

  it("metricsSnapshot() delegates to the metrics collector", () => {
    const registry = new GraphRegistry();
    const metrics = new KnowledgeGraphMetricsCollector();
    metrics.recordGraphCreated();
    const monitor = new KnowledgeGraphMonitor(registry, metrics);
    expect(monitor.metricsSnapshot().graphCount).toBe(1);
  });
});
