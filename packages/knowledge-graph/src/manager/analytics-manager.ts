import {
  calculateGraphStatistics,
  computeAverageDegree,
  detectCycles,
  findConnectedComponents,
  type CycleDetectionResult,
} from "../analytics/index.js";
import type { GraphCluster } from "../domain/graph-cluster.js";
import type { GraphStatistics } from "../domain/graph-statistics.js";
import type { KnowledgeEdgeType } from "../domain/knowledge-edge-type.js";
import { KnowledgeGraphEventType } from "../events/knowledge-graph-event-type.js";
import { validateGraph, type GraphValidationReport } from "../graph/graph-validator.js";

import type { GraphSystemContext } from "./graph-system-context.js";

/**
 * Owns the analytics-shaped Graph Operations: Cycle Detection, Connected Components, Average
 * Degree, Graph Validation, Graph Statistics. Every call refreshes the metrics collector's
 * `averageDegree`/`connectedComponents`/`cycleCount` gauges, so `GraphMetrics` snapshots stay
 * current without a background poller.
 */
export class AnalyticsManager {
  constructor(private readonly ctx: GraphSystemContext) {}

  connectedComponents(graphId: string): GraphCluster[] {
    const engine = this.ctx.graphRegistry.get(graphId);
    const clusters = findConnectedComponents(engine);
    this.ctx.metricsCollector.setConnectedComponents(clusters.length);
    return clusters;
  }

  cycleDetection(graphId: string, edgeTypes?: readonly KnowledgeEdgeType[]): CycleDetectionResult {
    const engine = this.ctx.graphRegistry.get(graphId);
    const result = detectCycles(engine, edgeTypes ? new Set(edgeTypes) : undefined);
    if (result.hasCycle) this.ctx.metricsCollector.recordCycleDetected();
    return result;
  }

  averageDegree(graphId: string): number {
    const engine = this.ctx.graphRegistry.get(graphId);
    const value = computeAverageDegree(engine);
    this.ctx.metricsCollector.setAverageDegree(value);
    return value;
  }

  graphValidation(graphId: string): GraphValidationReport {
    const engine = this.ctx.graphRegistry.get(graphId);
    const report = validateGraph(engine);
    this.ctx.eventPublisher.publish(KnowledgeGraphEventType.GraphValidated, { graphId, report });
    return report;
  }

  graphStatistics(graphId: string): GraphStatistics {
    const engine = this.ctx.graphRegistry.get(graphId);
    const statistics = calculateGraphStatistics(engine);
    this.ctx.metricsCollector.setAverageDegree(statistics.averageDegree);
    this.ctx.metricsCollector.setConnectedComponents(statistics.connectedComponentCount);
    return statistics;
  }
}
