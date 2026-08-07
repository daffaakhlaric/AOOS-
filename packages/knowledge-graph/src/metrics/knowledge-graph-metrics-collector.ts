import type { GraphMetrics } from "../domain/graph-metrics.js";

/**
 * Package-wide (cross-graph) metrics counters — the 8 metrics from the specification. Counters
 * are cumulative for the process lifetime; `averageDegree`/`connectedComponents`/`cycleCount` are
 * gauges updated by callers via `setAverageDegree`/`setConnectedComponents`/`recordCycle`.
 */
export class KnowledgeGraphMetricsCollector {
  private graphCount = 0;
  private nodeCount = 0;
  private edgeCount = 0;
  private relationshipCount = 0;
  private traversalCount = 0;
  private averageDegree = 0;
  private connectedComponents = 0;
  private cycleCount = 0;

  recordGraphCreated(): void {
    this.graphCount += 1;
  }

  recordGraphDeleted(): void {
    this.graphCount = Math.max(0, this.graphCount - 1);
  }

  recordNodeCreated(): void {
    this.nodeCount += 1;
  }

  recordNodeDeleted(): void {
    this.nodeCount = Math.max(0, this.nodeCount - 1);
  }

  recordEdgeCreated(): void {
    this.edgeCount += 1;
    this.relationshipCount += 1;
  }

  recordEdgeDeleted(): void {
    this.edgeCount = Math.max(0, this.edgeCount - 1);
    this.relationshipCount = Math.max(0, this.relationshipCount - 1);
  }

  recordTraversal(): void {
    this.traversalCount += 1;
  }

  recordCycleDetected(): void {
    this.cycleCount += 1;
  }

  setAverageDegree(value: number): void {
    this.averageDegree = value;
  }

  setConnectedComponents(value: number): void {
    this.connectedComponents = value;
  }

  snapshot(): GraphMetrics {
    return {
      graphCount: this.graphCount,
      nodeCount: this.nodeCount,
      edgeCount: this.edgeCount,
      relationshipCount: this.relationshipCount,
      traversalCount: this.traversalCount,
      averageDegree: this.averageDegree,
      connectedComponents: this.connectedComponents,
      cycleCount: this.cycleCount,
      capturedAt: Date.now(),
    };
  }

  reset(): void {
    this.graphCount = 0;
    this.nodeCount = 0;
    this.edgeCount = 0;
    this.relationshipCount = 0;
    this.traversalCount = 0;
    this.averageDegree = 0;
    this.connectedComponents = 0;
    this.cycleCount = 0;
  }
}
