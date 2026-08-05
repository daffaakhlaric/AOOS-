import type { NodeRuntimeHealthReport } from "../health/i-health-check.js";
import { NodeRuntimeHealth } from "../health/node-runtime-health.js";
import type {
  INodeRuntimeMetrics,
  NodeRuntimeMetricsSnapshot,
} from "../metrics/i-node-runtime-metrics.js";

export interface NodeRuntimeSnapshot {
  readonly metrics: NodeRuntimeMetricsSnapshot;
  readonly health: NodeRuntimeHealthReport;
  readonly sampledAt: string;
}

/** "MONITORING: OpenTelemetry Ready, Trace ID, Correlation ID, Metrics" (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md) — combines Metrics + Health into one sampled snapshot. */
export class NodeRuntimeMonitor {
  readonly health: NodeRuntimeHealth;

  constructor(private readonly metrics: INodeRuntimeMetrics) {
    this.health = new NodeRuntimeHealth(() => this.metrics.snapshot());
  }

  sample(): NodeRuntimeSnapshot {
    return {
      metrics: this.metrics.snapshot(),
      health: this.health.check(),
      sampledAt: new Date().toISOString(),
    };
  }
}
