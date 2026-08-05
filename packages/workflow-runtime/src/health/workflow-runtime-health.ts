import type { WorkflowRuntimeMetricsSnapshot } from "../metrics/i-workflow-runtime-metrics.js";

import type {
  ComponentHealth,
  HealthStatus,
  WorkflowRuntimeHealthReport,
} from "./i-health-check.js";

type Component = "loader" | "validator" | "stateMachine" | "context";

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

/** Derives Runtime Health from the live Metrics snapshot (failure ratio) plus any component-level error recorded via `recordError()`. */
export class WorkflowRuntimeHealth {
  private readonly lastError = new Map<Component, string>();

  constructor(private readonly getMetrics: () => WorkflowRuntimeMetricsSnapshot) {}

  /** Called by callers (e.g. the middleware pipeline's error handling) when a component fails — the next `check()` will report it as unhealthy until cleared. */
  recordError(component: Component, message: string): void {
    this.lastError.set(component, message);
  }

  clearError(component: Component): void {
    this.lastError.delete(component);
  }

  check(): WorkflowRuntimeHealthReport {
    const metrics = this.getMetrics();
    const totalFinished = metrics.completedWorkflows + metrics.failedWorkflows;
    const failureRatio = totalFinished === 0 ? 0 : metrics.failedWorkflows / totalFinished;
    const runtimeStatus: HealthStatus =
      failureRatio > 0.5 ? "unhealthy" : failureRatio > 0.1 ? "degraded" : "healthy";
    const runtime: ComponentHealth = { status: runtimeStatus, details: { failureRatio } };

    const loader = this.componentHealth("loader");
    const validator = this.componentHealth("validator");
    const stateMachine = this.componentHealth("stateMachine");
    const context = this.componentHealth("context");

    return {
      status: worstOf(
        runtime.status,
        loader.status,
        validator.status,
        stateMachine.status,
        context.status,
      ),
      runtime,
      loader,
      validator,
      stateMachine,
      context,
    };
  }

  private componentHealth(component: Component): ComponentHealth {
    const error = this.lastError.get(component);
    return error === undefined
      ? { status: "healthy" }
      : { status: "unhealthy", details: { error } };
  }
}
