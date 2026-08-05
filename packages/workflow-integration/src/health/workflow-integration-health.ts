import type { IWorkflowIntegrationMetrics } from "../metrics/i-workflow-integration-metrics.js";
import type { WorkflowIntegrationRegistry } from "../registry/workflow-integration-registry.js";

import type {
  ComponentHealth,
  HealthStatus,
  WorkflowIntegrationHealthReport,
} from "./i-health-check.js";

const STATUS_RANK: Readonly<Record<HealthStatus, number>> = {
  healthy: 0,
  degraded: 1,
  unavailable: 2,
  unknown: 3,
};

function worstOf(...statuses: readonly HealthStatus[]): HealthStatus {
  return statuses.reduce((worst, current) =>
    STATUS_RANK[current] > STATUS_RANK[worst] ? current : worst,
  );
}

/**
 * Derives per-Adapter health from `WorkflowIntegrationRegistry#list()`'s
 * `isAvailable()`, Resolver health from the live Metrics failure ratio, and Registry
 * health from whether anything is registered at all.
 */
export class WorkflowIntegrationHealth {
  constructor(
    private readonly registry: WorkflowIntegrationRegistry,
    private readonly getMetrics: () => ReturnType<IWorkflowIntegrationMetrics["snapshot"]>,
  ) {}

  check(): WorkflowIntegrationHealthReport {
    const adapters: Record<string, ComponentHealth> = {};
    for (const namespace of this.registry.listNamespaces()) {
      for (const adapter of this.registry.list(namespace)) {
        adapters[adapter.name] = adapter.isAvailable()
          ? { status: "healthy" }
          : { status: "unavailable", details: { namespace: adapter.namespace } };
      }
    }

    const registryHealth: ComponentHealth =
      this.registry.listNamespaces().length === 0
        ? { status: "unknown", details: { reason: "no Adapters registered" } }
        : { status: "healthy" };

    const metrics = this.getMetrics();
    const totalFinished = metrics.completed + metrics.failures;
    const failureRatio = totalFinished === 0 ? 0 : metrics.failures / totalFinished;
    const resolverStatus: HealthStatus =
      failureRatio > 0.5 ? "unavailable" : failureRatio > 0.1 ? "degraded" : "healthy";
    const resolverHealth: ComponentHealth = { status: resolverStatus, details: { failureRatio } };

    const adapterStatuses = Object.values(adapters).map((health) => health.status);
    const status = worstOf(
      registryHealth.status,
      resolverHealth.status,
      ...(adapterStatuses.length > 0 ? adapterStatuses : ["healthy" as const]),
    );

    return { status, registry: registryHealth, resolver: resolverHealth, adapters };
  }
}
