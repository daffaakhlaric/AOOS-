import type { KnowledgeProviderMetricsSnapshot } from "../metrics/i-knowledge-provider-metrics.js";
import { KnowledgeProviderRegistryBucket } from "../registry/knowledge-provider-registry-bucket.js";
import type { KnowledgeProviderRegistry } from "../registry/knowledge-provider-registry.js";

import type {
  ComponentHealth,
  HealthStatus,
  KnowledgeProviderHealthReport,
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

/** Derives Registry health from whether any Provider/Policy/Metadata is registered, and Provider health from the live `failureCount/registrationCount` ratio. */
export class KnowledgeProviderHealth {
  constructor(
    private readonly registry: KnowledgeProviderRegistry,
    private readonly getMetrics: () => KnowledgeProviderMetricsSnapshot,
  ) {}

  check(): KnowledgeProviderHealthReport {
    const registeredEntries = Object.values(KnowledgeProviderRegistryBucket).reduce(
      (total, bucket) => total + this.registry.count(bucket),
      0,
    );
    const registryHealth: ComponentHealth =
      registeredEntries === 0
        ? { status: "unknown", details: { reason: "no Providers/Policies/Metadata registered" } }
        : { status: "healthy" };

    const metrics = this.getMetrics();
    const failureRatio =
      metrics.registrationCount === 0 ? 0 : metrics.failureCount / metrics.registrationCount;
    const providerStatus: HealthStatus =
      failureRatio > 0.5
        ? "unavailable"
        : failureRatio > 0.2
          ? "degraded"
          : failureRatio > 0
            ? "warning"
            : "healthy";
    const providerHealth: ComponentHealth = { status: providerStatus, details: { failureRatio } };

    return {
      status: worstOf(registryHealth.status, providerHealth.status),
      registry: registryHealth,
      provider: providerHealth,
    };
  }
}
