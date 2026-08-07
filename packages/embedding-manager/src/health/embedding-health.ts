import { EmbeddingRegistryBucket } from "../registry/embedding-registry-bucket.js";
import type { EmbeddingRegistry } from "../registry/embedding-registry.js";

import type {
  ComponentHealth,
  EmbeddingManagerHealthReport,
  HealthStatus,
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

/**
 * "HEALTH" — Registry health from bucket occupancy, domain health from a
 * caller-reported failure/success ratio.
 */
export class EmbeddingHealth {
  constructor(private readonly registry: EmbeddingRegistry) {}

  check(successCount = 0, failureCount = 0): EmbeddingManagerHealthReport {
    const registeredEntries = Object.values(EmbeddingRegistryBucket).reduce(
      (total, bucket) => total + this.registry.count(bucket),
      0,
    );
    const registryHealth: ComponentHealth =
      registeredEntries === 0
        ? { status: "unknown", details: { reason: "no Embeddings registered" } }
        : { status: "healthy", details: { count: registeredEntries } };

    const domainHealth = this.domainHealth(successCount, failureCount);

    return {
      status: worstOf(registryHealth.status, domainHealth.status),
      registry: registryHealth,
      domain: domainHealth,
    };
  }

  private domainHealth(successCount: number, failureCount: number): ComponentHealth {
    const total = successCount + failureCount;
    if (total === 0) {
      return { status: "unknown", details: { reason: "no operations recorded yet" } };
    }
    const failureRatio = failureCount / total;
    if (failureRatio === 0) {
      return { status: "healthy", details: { successCount, failureCount } };
    }
    if (failureRatio < 0.1) {
      return { status: "warning", details: { successCount, failureCount } };
    }
    if (failureRatio < 0.5) {
      return { status: "degraded", details: { successCount, failureCount } };
    }
    return { status: "unavailable", details: { successCount, failureCount } };
  }
}
