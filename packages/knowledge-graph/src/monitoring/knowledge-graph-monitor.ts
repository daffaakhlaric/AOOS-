import { validateGraph } from "../graph/graph-validator.js";
import type { KnowledgeGraphMetricsCollector } from "../metrics/knowledge-graph-metrics-collector.js";
import type { GraphRegistry } from "../registry/graph-registry.js";

export type HealthStatus = "healthy" | "degraded";

export interface HealthReport {
  readonly status: HealthStatus;
  readonly graphCount: number;
  readonly issues: readonly string[];
}

export interface PerformanceReport {
  readonly averageTraversalDurationMs: number;
  readonly traversalSampleCount: number;
}

export interface GraphSizeReport {
  readonly graphId: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

/**
 * The 5 Monitoring dimensions from the specification: Health, Performance, Traversal Time,
 * Memory Usage, Graph Size. Reads from the live `GraphRegistry`/`KnowledgeGraphMetricsCollector`
 * rather than caching its own copies, so every report reflects current state.
 */
export class KnowledgeGraphMonitor {
  private readonly traversalDurationsMs: number[] = [];

  constructor(
    private readonly graphRegistry: GraphRegistry,
    private readonly metricsCollector: KnowledgeGraphMetricsCollector,
  ) {}

  /** Records one traversal's duration for the Performance / Traversal Time dimensions. */
  recordTraversalDuration(durationMs: number): void {
    this.traversalDurationsMs.push(durationMs);
  }

  /** Health: every registered graph passes structural validation (no dangling edges / self-loops). */
  health(): HealthReport {
    const issues: string[] = [];
    for (const engine of this.graphRegistry.list()) {
      const report = validateGraph(engine);
      if (!report.valid) {
        issues.push(...report.issues.map((issue) => issue.message));
      }
    }
    return {
      status: issues.length === 0 ? "healthy" : "degraded",
      graphCount: this.graphRegistry.size,
      issues,
    };
  }

  /** Performance: average traversal duration across every BFS/DFS/shortest-path run so far. */
  performance(): PerformanceReport {
    const traversalSampleCount = this.traversalDurationsMs.length;
    const averageTraversalDurationMs =
      traversalSampleCount === 0
        ? 0
        : this.traversalDurationsMs.reduce((sum, value) => sum + value, 0) / traversalSampleCount;
    return { averageTraversalDurationMs, traversalSampleCount };
  }

  /** Traversal Time: convenience accessor equal to `performance().averageTraversalDurationMs`. */
  traversalTime(): number {
    return this.performance().averageTraversalDurationMs;
  }

  /** Memory Usage: process heap usage in bytes (0 in environments without `process.memoryUsage`). */
  memoryUsage(): number {
    return typeof process !== "undefined" && typeof process.memoryUsage === "function"
      ? process.memoryUsage().heapUsed
      : 0;
  }

  /** Graph Size: node/edge counts for a specific graph. */
  graphSize(graphId: string): GraphSizeReport {
    const engine = this.graphRegistry.get(graphId);
    return {
      graphId,
      nodeCount: engine.listNodes().length,
      edgeCount: engine.listEdges().length,
    };
  }

  /** Convenience accessor over the underlying metrics collector's cumulative counters. */
  metricsSnapshot() {
    return this.metricsCollector.snapshot();
  }
}
