import type { NodeType } from "../contracts/node-type.js";

export interface NodeRuntimeMetricsSnapshot {
  readonly nodeCount: number;
  readonly nodeSuccessCount: number;
  readonly nodeFailureCount: number;
  readonly averageNodeRuntimeMs: number;
  readonly countByType: Readonly<Partial<Record<NodeType, number>>>;
  readonly averageExecutionLatencyMs: Readonly<Record<string, number>>;
}

/** "METRICS" (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md): Node Count, Node Success, Node Failure, Node Runtime, Node Type, Execution Latency. */
export interface INodeRuntimeMetrics {
  recordNodeCreated(type: NodeType): void;
  recordNodeSuccess(runtimeMs: number): void;
  recordNodeFailure(): void;
  recordExecutionLatency(operation: string, ms: number): void;
  snapshot(): NodeRuntimeMetricsSnapshot;
}
