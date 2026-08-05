import type { KnowledgeSynchronizationMetricsSnapshot } from "../metrics/i-knowledge-synchronization-metrics.js";
import { KnowledgeSynchronizationRegistryBucket } from "../registry/knowledge-synchronization-registry-bucket.js";
import type { KnowledgeSynchronizationRegistry } from "../registry/knowledge-synchronization-registry.js";

import type {
  ComponentHealth,
  HealthStatus,
  KnowledgeSynchronizationHealthReport,
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

/** Derives Registry health from whether any Provider/Policy/Schedule is registered, and Synchronization health from the live `failedSynchronizations/synchronizationCount` ratio. */
export class KnowledgeSynchronizationHealth {
  constructor(
    private readonly registry: KnowledgeSynchronizationRegistry,
    private readonly getMetrics: () => KnowledgeSynchronizationMetricsSnapshot,
  ) {}

  check(): KnowledgeSynchronizationHealthReport {
    const registeredEntries = Object.values(KnowledgeSynchronizationRegistryBucket).reduce(
      (total, bucket) => total + this.registry.count(bucket),
      0,
    );
    const registryHealth: ComponentHealth =
      registeredEntries === 0
        ? { status: "unknown", details: { reason: "no Providers/Policies/Schedules registered" } }
        : { status: "healthy" };

    const metrics = this.getMetrics();
    const failureRatio =
      metrics.synchronizationCount === 0
        ? 0
        : metrics.failedSynchronizations / metrics.synchronizationCount;
    const synchronizationStatus: HealthStatus =
      failureRatio > 0.5
        ? "unavailable"
        : failureRatio > 0.2
          ? "degraded"
          : failureRatio > 0
            ? "warning"
            : "healthy";
    const synchronizationHealth: ComponentHealth = {
      status: synchronizationStatus,
      details: { failureRatio },
    };

    return {
      status: worstOf(registryHealth.status, synchronizationHealth.status),
      registry: registryHealth,
      synchronization: synchronizationHealth,
    };
  }
}
