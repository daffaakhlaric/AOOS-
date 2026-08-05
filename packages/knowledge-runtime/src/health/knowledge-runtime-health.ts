import type { KnowledgeRuntimeMetricsSnapshot } from "../metrics/i-knowledge-runtime-metrics.js";
import type { KnowledgeRuntimeRegistry } from "../registry/knowledge-runtime-registry.js";

import type {
  ComponentHealth,
  HealthStatus,
  KnowledgeRuntimeHealthReport,
} from "./i-health-check.js";

const STATUS_RANK: Readonly<Record<HealthStatus, number>> = {
  healthy: 0,
  warning: 1,
  degraded: 2,
  unavailable: 3,
  unknown: 4,
};

function worstOf(...statuses: readonly HealthStatus[]): HealthStatus {
  return statuses.reduce((worst, current) =>
    STATUS_RANK[current] > STATUS_RANK[worst] ? current : worst,
  );
}

/** Derives Registry health from whether any Instance is registered, Validation health from the live `validationFailures`/`runtimeCount` ratio, and Failure Rate health from `failedRuntimeCount`/`runtimeCount`. */
export class KnowledgeRuntimeHealth {
  constructor(
    private readonly registry: KnowledgeRuntimeRegistry,
    private readonly getMetrics: () => KnowledgeRuntimeMetricsSnapshot,
  ) {}

  check(): KnowledgeRuntimeHealthReport {
    const registryHealth: ComponentHealth =
      this.registry.count() === 0
        ? { status: "unknown", details: { reason: "no Instances registered" } }
        : { status: "healthy" };

    const metrics = this.getMetrics();
    const validationRatio =
      metrics.runtimeCount === 0 ? 0 : metrics.validationFailures / metrics.runtimeCount;
    const validationStatus: HealthStatus =
      validationRatio > 0.5
        ? "unavailable"
        : validationRatio > 0.2
          ? "degraded"
          : validationRatio > 0
            ? "warning"
            : "healthy";
    const validationHealth: ComponentHealth = {
      status: validationStatus,
      details: { validationRatio },
    };

    const failureRatio =
      metrics.runtimeCount === 0 ? 0 : metrics.failedRuntimeCount / metrics.runtimeCount;
    const failureStatus: HealthStatus =
      failureRatio > 0.5
        ? "unavailable"
        : failureRatio > 0.2
          ? "degraded"
          : failureRatio > 0
            ? "warning"
            : "healthy";
    const failureRateHealth: ComponentHealth = { status: failureStatus, details: { failureRatio } };

    return {
      status: worstOf(registryHealth.status, validationHealth.status, failureRateHealth.status),
      registry: registryHealth,
      validation: validationHealth,
      failureRate: failureRateHealth,
    };
  }
}
