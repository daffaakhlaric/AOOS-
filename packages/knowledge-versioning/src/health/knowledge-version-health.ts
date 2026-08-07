import { KnowledgeVersionRegistryBucket } from "../registry/knowledge-version-registry-bucket.js";
import type { KnowledgeVersionRegistry } from "../registry/knowledge-version-registry.js";

import type {
  ComponentHealth,
  HealthStatus,
  KnowledgeVersionHealthReport,
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
 * "HEALTH" — Registry health from bucket occupancy (are any of the 8 buckets populated),
 * domain health from a caller-reported failure/success ratio (e.g. Pipeline Validation
 * outcomes) — the same shape as every prior AOS Knowledge package's Health class.
 */
export class KnowledgeVersionHealth {
  constructor(private readonly registry: KnowledgeVersionRegistry) {}

  check(successCount = 0, failureCount = 0): KnowledgeVersionHealthReport {
    const registeredEntries = Object.values(KnowledgeVersionRegistryBucket).reduce(
      (total, bucket) => total + this.registry.count(bucket),
      0,
    );
    const registryHealth: ComponentHealth =
      registeredEntries === 0
        ? { status: "unknown", details: { reason: "no Versions/Branches/Snapshots registered" } }
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
