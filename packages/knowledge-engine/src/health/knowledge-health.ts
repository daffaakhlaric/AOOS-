import type { KnowledgeMetricsSnapshot } from "../metrics/i-knowledge-metrics.js";
import { KnowledgeRegistryBucket } from "../registry/knowledge-registry-bucket.js";
import type { KnowledgeRegistry } from "../registry/knowledge-registry.js";
import type { KnowledgeRepository } from "../repository/knowledge-repository.js";

import type { ComponentHealth, HealthStatus, KnowledgeHealthReport } from "./i-health-check.js";

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

/** Derives Repository health from whether any Asset is saved, Registry health from whether any bucket has entries, and Validation health from the live `validationErrors`/`knowledgeCount` ratio. */
export class KnowledgeHealth {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly registry: KnowledgeRegistry,
    private readonly getMetrics: () => KnowledgeMetricsSnapshot,
  ) {}

  check(): KnowledgeHealthReport {
    const repositoryHealth: ComponentHealth =
      this.repository.count() === 0
        ? { status: "unknown", details: { reason: "no Assets saved" } }
        : { status: "healthy" };

    const registryEntryCount = Object.values(KnowledgeRegistryBucket).reduce(
      (total, bucket) => total + this.registry.count(bucket),
      0,
    );
    const registryHealth: ComponentHealth =
      registryEntryCount === 0
        ? { status: "unknown", details: { reason: "no Registry entries" } }
        : { status: "healthy" };

    const metrics = this.getMetrics();
    const errorRatio =
      metrics.knowledgeCount === 0 ? 0 : metrics.validationErrors / metrics.knowledgeCount;
    const validationStatus: HealthStatus =
      errorRatio > 0.5
        ? "unavailable"
        : errorRatio > 0.2
          ? "degraded"
          : errorRatio > 0
            ? "warning"
            : "healthy";
    const validationHealth: ComponentHealth = { status: validationStatus, details: { errorRatio } };

    return {
      status: worstOf(repositoryHealth.status, registryHealth.status, validationHealth.status),
      repository: repositoryHealth,
      registry: registryHealth,
      validation: validationHealth,
    };
  }
}
