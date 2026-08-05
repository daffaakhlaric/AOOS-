import type { WorkflowRuntimeHealthReport } from "../health/i-health-check.js";
import { WorkflowRuntimeHealth } from "../health/workflow-runtime-health.js";
import type {
  IWorkflowRuntimeMetrics,
  WorkflowRuntimeMetricsSnapshot,
} from "../metrics/i-workflow-runtime-metrics.js";

export interface WorkflowRuntimeSnapshot {
  readonly metrics: WorkflowRuntimeMetricsSnapshot;
  readonly health: WorkflowRuntimeHealthReport;
  readonly sampledAt: string;
}

/** "MONITORING: OpenTelemetry Ready, Correlation ID, Trace ID, Runtime Metrics" (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md) — combines Metrics + Health into one sampled snapshot, mirroring `@aos/scheduler`'s `SchedulerMonitor`. */
export class WorkflowRuntimeMonitor {
  readonly health: WorkflowRuntimeHealth;

  constructor(private readonly metrics: IWorkflowRuntimeMetrics) {
    this.health = new WorkflowRuntimeHealth(() => this.metrics.snapshot());
  }

  sample(): WorkflowRuntimeSnapshot {
    return {
      metrics: this.metrics.snapshot(),
      health: this.health.check(),
      sampledAt: new Date().toISOString(),
    };
  }
}
