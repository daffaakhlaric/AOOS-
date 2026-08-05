import { InstanceState } from "../instance/instance-state.js";

import type {
  IWorkflowRuntimeMetrics,
  WorkflowRuntimeMetricsSnapshot,
} from "./i-workflow-runtime-metrics.js";

function emptyStateCount(): Record<InstanceState, number> {
  const count = {} as Record<InstanceState, number>;
  for (const state of Object.values(InstanceState)) {
    count[state] = 0;
  }
  return count;
}

interface LatencySample {
  totalMs: number;
  samples: number;
}

export class WorkflowRuntimeMetricsCollector implements IWorkflowRuntimeMetrics {
  private runningWorkflows = 0;
  private completedWorkflows = 0;
  private failedWorkflows = 0;
  private totalRuntimeMs = 0;
  private completedSamples = 0;
  private readonly currentStateCount = emptyStateCount();
  private readonly latencyByOperation = new Map<string, LatencySample>();

  recordInstanceCreated(): void {
    this.runningWorkflows += 1;
  }

  recordInstanceCompleted(runtimeMs: number): void {
    this.completedWorkflows += 1;
    this.totalRuntimeMs += runtimeMs;
    this.completedSamples += 1;
    this.runningWorkflows = Math.max(0, this.runningWorkflows - 1);
  }

  recordInstanceFailed(): void {
    this.failedWorkflows += 1;
    this.runningWorkflows = Math.max(0, this.runningWorkflows - 1);
  }

  recordStateChange(to: InstanceState, from?: InstanceState): void {
    if (from !== undefined) {
      this.currentStateCount[from] = Math.max(0, this.currentStateCount[from] - 1);
    }
    this.currentStateCount[to] += 1;
  }

  recordExecutionLatency(operation: string, ms: number): void {
    const existing = this.latencyByOperation.get(operation) ?? { totalMs: 0, samples: 0 };
    this.latencyByOperation.set(operation, {
      totalMs: existing.totalMs + ms,
      samples: existing.samples + 1,
    });
  }

  snapshot(): WorkflowRuntimeMetricsSnapshot {
    const averageExecutionLatencyMs: Record<string, number> = {};
    for (const [operation, sample] of this.latencyByOperation) {
      averageExecutionLatencyMs[operation] =
        sample.samples === 0 ? 0 : sample.totalMs / sample.samples;
    }
    return {
      runningWorkflows: this.runningWorkflows,
      completedWorkflows: this.completedWorkflows,
      failedWorkflows: this.failedWorkflows,
      averageRuntimeMs:
        this.completedSamples === 0 ? 0 : this.totalRuntimeMs / this.completedSamples,
      currentStateCount: { ...this.currentStateCount },
      averageExecutionLatencyMs,
    };
  }
}
