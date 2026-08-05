import type { ExecutionMetricsSnapshot } from "../metrics/i-execution-metrics.js";

import type { ComponentHealth, ExecutionHealthReport, HealthStatus } from "./i-health-check.js";

type Component = "executionQueue" | "waitingWorkflow" | "deadWorkflow" | "checkpoint";

const STATUS_RANK: Readonly<Record<HealthStatus, number>> = {
  healthy: 0,
  degraded: 1,
  unhealthy: 2,
};

function worstOf(...statuses: readonly HealthStatus[]): HealthStatus {
  return statuses.reduce((worst, current) =>
    STATUS_RANK[current] > STATUS_RANK[worst] ? current : worst,
  );
}

/** Derives Running Workflow health from the live Metrics snapshot (failure ratio) plus any component-level error recorded via `recordError()`. */
export class ExecutionHealth {
  private readonly lastError = new Map<Component, string>();

  constructor(private readonly getMetrics: () => ExecutionMetricsSnapshot) {}

  recordError(component: Component, message: string): void {
    this.lastError.set(component, message);
  }

  clearError(component: Component): void {
    this.lastError.delete(component);
  }

  check(): ExecutionHealthReport {
    const metrics = this.getMetrics();
    const totalFinished = metrics.completedCount + metrics.failedCount;
    const failureRatio = totalFinished === 0 ? 0 : metrics.failedCount / totalFinished;
    const runningStatus: HealthStatus =
      failureRatio > 0.5 ? "unhealthy" : failureRatio > 0.1 ? "degraded" : "healthy";
    const runningWorkflow: ComponentHealth = {
      status: runningStatus,
      details: { failureRatio, runningCount: metrics.runningCount },
    };

    const executionQueue = this.componentHealth("executionQueue");
    const waitingWorkflow = this.componentHealth("waitingWorkflow");
    const deadWorkflow = this.componentHealth("deadWorkflow");
    const checkpoint = this.componentHealth("checkpoint");

    return {
      status: worstOf(
        runningWorkflow.status,
        executionQueue.status,
        waitingWorkflow.status,
        deadWorkflow.status,
        checkpoint.status,
      ),
      executionQueue,
      runningWorkflow,
      waitingWorkflow,
      deadWorkflow,
      checkpoint,
    };
  }

  private componentHealth(component: Component): ComponentHealth {
    const error = this.lastError.get(component);
    return error === undefined
      ? { status: "healthy" }
      : { status: "unhealthy", details: { error } };
  }
}
