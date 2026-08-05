import type { NodeType } from "../contracts/node-type.js";

import type { INodeRuntimeMetrics, NodeRuntimeMetricsSnapshot } from "./i-node-runtime-metrics.js";

interface LatencySample {
  totalMs: number;
  samples: number;
}

export class NodeRuntimeMetricsCollector implements INodeRuntimeMetrics {
  private nodeCount = 0;
  private nodeSuccessCount = 0;
  private nodeFailureCount = 0;
  private totalRuntimeMs = 0;
  private successSamples = 0;
  private readonly countByType = new Map<NodeType, number>();
  private readonly latencyByOperation = new Map<string, LatencySample>();

  recordNodeCreated(type: NodeType): void {
    this.nodeCount += 1;
    this.countByType.set(type, (this.countByType.get(type) ?? 0) + 1);
  }

  recordNodeSuccess(runtimeMs: number): void {
    this.nodeSuccessCount += 1;
    this.totalRuntimeMs += runtimeMs;
    this.successSamples += 1;
  }

  recordNodeFailure(): void {
    this.nodeFailureCount += 1;
  }

  recordExecutionLatency(operation: string, ms: number): void {
    const existing = this.latencyByOperation.get(operation) ?? { totalMs: 0, samples: 0 };
    this.latencyByOperation.set(operation, {
      totalMs: existing.totalMs + ms,
      samples: existing.samples + 1,
    });
  }

  snapshot(): NodeRuntimeMetricsSnapshot {
    const averageExecutionLatencyMs: Record<string, number> = {};
    for (const [operation, sample] of this.latencyByOperation) {
      averageExecutionLatencyMs[operation] =
        sample.samples === 0 ? 0 : sample.totalMs / sample.samples;
    }
    const countByType: Partial<Record<NodeType, number>> = {};
    for (const [type, count] of this.countByType) {
      countByType[type] = count;
    }
    return {
      nodeCount: this.nodeCount,
      nodeSuccessCount: this.nodeSuccessCount,
      nodeFailureCount: this.nodeFailureCount,
      averageNodeRuntimeMs:
        this.successSamples === 0 ? 0 : this.totalRuntimeMs / this.successSamples,
      countByType,
      averageExecutionLatencyMs,
    };
  }
}
