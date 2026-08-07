import { KnowledgeMetricName } from "../types/metric-name.js";

import {
  BaseKnowledgeAnalyticsService,
  type BaseKnowledgeAnalyticsServiceOptions,
} from "./base-knowledge-analytics-service.js";

/** A caller-supplied graph-shape reading (this package never inspects a real graph itself). */
export interface GraphSnapshotEvent {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly connectedComponents: number;
}

/**
 * Owns: Graph Node Count, Graph Edge Count, Connected Components, Average Graph Degree.
 *
 * These mirror the exact metric names `@aos/knowledge-graph` computes, but this package never
 * imports that package — it only accepts the same kind of numbers as caller-supplied input.
 */
export class KnowledgeGraphAnalytics extends BaseKnowledgeAnalyticsService {
  constructor(options: BaseKnowledgeAnalyticsServiceOptions = {}) {
    super(options);
  }

  recordGraphSnapshot(event: GraphSnapshotEvent): void {
    this.record(KnowledgeMetricName.GraphNodeCount, event.nodeCount);
    this.record(KnowledgeMetricName.GraphEdgeCount, event.edgeCount);
    this.record(KnowledgeMetricName.ConnectedComponents, event.connectedComponents);
    this.publish(KnowledgeMetricName.GraphNodeCount, this.latestNodeCount());
    this.publish(KnowledgeMetricName.GraphEdgeCount, this.latestEdgeCount());
    this.publish(KnowledgeMetricName.ConnectedComponents, this.latestConnectedComponents());
    this.publish(KnowledgeMetricName.AverageGraphDegree, this.averageGraphDegree());
  }

  private latestOf(metricName: string): number {
    const values = this.valuesFor(metricName);
    return values.length === 0 ? 0 : values[values.length - 1]!;
  }

  latestNodeCount(): number {
    return this.latestOf(KnowledgeMetricName.GraphNodeCount);
  }

  latestEdgeCount(): number {
    return this.latestOf(KnowledgeMetricName.GraphEdgeCount);
  }

  latestConnectedComponents(): number {
    return this.latestOf(KnowledgeMetricName.ConnectedComponents);
  }

  /** Average node degree = (2 * edgeCount) / nodeCount for an undirected-degree convention. */
  averageGraphDegree(): number {
    const nodeCount = this.latestNodeCount();
    if (nodeCount === 0) return 0;
    return (2 * this.latestEdgeCount()) / nodeCount;
  }

  summary(): Readonly<Record<string, unknown>> {
    return {
      nodeCount: this.latestNodeCount(),
      edgeCount: this.latestEdgeCount(),
      connectedComponents: this.latestConnectedComponents(),
      averageGraphDegree: this.averageGraphDegree(),
    };
  }
}
