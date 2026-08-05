import type { KnowledgeIndexMetricsSnapshot } from "../metrics/i-knowledge-index-metrics.js";
import { KnowledgeIndexRegistryBucket } from "../registry/knowledge-index-registry-bucket.js";
import type { KnowledgeIndexRegistry } from "../registry/knowledge-index-registry.js";

import type {
  ComponentHealth,
  HealthStatus,
  KnowledgeIndexHealthReport,
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

/** Derives Registry health from whether any Index Entry is registered, and Build health from the live `buildFailures`/`buildCount` ratio. */
export class KnowledgeIndexHealth {
  constructor(
    private readonly registry: KnowledgeIndexRegistry,
    private readonly getMetrics: () => KnowledgeIndexMetricsSnapshot,
  ) {}

  check(): KnowledgeIndexHealthReport {
    const registryHealth: ComponentHealth =
      this.registry.count(KnowledgeIndexRegistryBucket.INDEX) === 0
        ? { status: "unknown", details: { reason: "no Index Entries registered" } }
        : { status: "healthy" };

    const metrics = this.getMetrics();
    const failureRatio = metrics.buildCount === 0 ? 0 : metrics.buildFailures / metrics.buildCount;
    const buildStatus: HealthStatus =
      failureRatio > 0.5
        ? "unavailable"
        : failureRatio > 0.2
          ? "degraded"
          : failureRatio > 0
            ? "warning"
            : "healthy";
    const buildHealth: ComponentHealth = { status: buildStatus, details: { failureRatio } };

    return {
      status: worstOf(registryHealth.status, buildHealth.status),
      registry: registryHealth,
      build: buildHealth,
    };
  }
}
