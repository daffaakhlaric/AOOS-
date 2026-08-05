import type { NodeRuntimeMetricsSnapshot } from "../metrics/i-node-runtime-metrics.js";

import type { ComponentHealth, HealthStatus, NodeRuntimeHealthReport } from "./i-health-check.js";

type Component = "registry" | "factory" | "validator" | "resolver";

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
export class NodeRuntimeHealth {
  private readonly lastError = new Map<Component, string>();

  constructor(private readonly getMetrics: () => NodeRuntimeMetricsSnapshot) {}

  recordError(component: Component, message: string): void {
    this.lastError.set(component, message);
  }

  clearError(component: Component): void {
    this.lastError.delete(component);
  }

  check(): NodeRuntimeHealthReport {
    const metrics = this.getMetrics();
    const totalFinished = metrics.nodeSuccessCount + metrics.nodeFailureCount;
    const failureRatio = totalFinished === 0 ? 0 : metrics.nodeFailureCount / totalFinished;
    const runtimeStatus: HealthStatus =
      failureRatio > 0.5 ? "unhealthy" : failureRatio > 0.1 ? "degraded" : "healthy";
    const runtime: ComponentHealth = { status: runtimeStatus, details: { failureRatio } };

    const registry = this.componentHealth("registry");
    const factory = this.componentHealth("factory");
    const validator = this.componentHealth("validator");
    const resolver = this.componentHealth("resolver");

    return {
      status: worstOf(
        runtime.status,
        registry.status,
        factory.status,
        validator.status,
        resolver.status,
      ),
      runtime,
      registry,
      factory,
      validator,
      resolver,
    };
  }

  private componentHealth(component: Component): ComponentHealth {
    const error = this.lastError.get(component);
    return error === undefined
      ? { status: "healthy" }
      : { status: "unhealthy", details: { error } };
  }
}
