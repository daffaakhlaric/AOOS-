import type { KnowledgeRetrievalMetricsSnapshot } from "../metrics/i-knowledge-retrieval-metrics.js";
import { KnowledgeRetrievalRegistryBucket } from "../registry/knowledge-retrieval-registry-bucket.js";
import type { KnowledgeRetrievalRegistry } from "../registry/knowledge-retrieval-registry.js";

import type {
  ComponentHealth,
  HealthStatus,
  KnowledgeRetrievalHealthReport,
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

/** Derives Registry health from whether any Search/Ranking Strategy is registered, and Query health from the live `failedQueries`/`totalQueries` ratio. */
export class KnowledgeRetrievalHealth {
  constructor(
    private readonly registry: KnowledgeRetrievalRegistry,
    private readonly getMetrics: () => KnowledgeRetrievalMetricsSnapshot,
  ) {}

  check(): KnowledgeRetrievalHealthReport {
    const registeredEntries = Object.values(KnowledgeRetrievalRegistryBucket).reduce(
      (total, bucket) => total + this.registry.count(bucket),
      0,
    );
    const registryHealth: ComponentHealth =
      registeredEntries === 0
        ? { status: "unknown", details: { reason: "no Strategies/Filters/Policies registered" } }
        : { status: "healthy" };

    const metrics = this.getMetrics();
    const failureRatio =
      metrics.totalQueries === 0 ? 0 : metrics.failedQueries / metrics.totalQueries;
    const queryStatus: HealthStatus =
      failureRatio > 0.5
        ? "unavailable"
        : failureRatio > 0.2
          ? "degraded"
          : failureRatio > 0
            ? "warning"
            : "healthy";
    const queryHealth: ComponentHealth = { status: queryStatus, details: { failureRatio } };

    return {
      status: worstOf(registryHealth.status, queryHealth.status),
      registry: registryHealth,
      query: queryHealth,
    };
  }
}
