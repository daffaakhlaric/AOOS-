import type { KnowledgeSourceCatalog } from "../catalog/knowledge-source-catalog.js";
import { KnowledgeSourceRegistryBucket } from "../registry/knowledge-source-registry-bucket.js";
import type { KnowledgeSourceRegistry } from "../registry/knowledge-source-registry.js";

import type {
  ComponentHealth,
  HealthStatus,
  KnowledgeSourceHealthReport,
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

/** Derives Registry health from whether any Source/Policy/Permission is registered, and Catalog health from whether the Catalog holds any entries. */
export class KnowledgeSourceHealth {
  constructor(
    private readonly registry: KnowledgeSourceRegistry,
    private readonly catalog: KnowledgeSourceCatalog,
  ) {}

  check(): KnowledgeSourceHealthReport {
    const registeredEntries = Object.values(KnowledgeSourceRegistryBucket).reduce(
      (total, bucket) => total + this.registry.count(bucket),
      0,
    );
    const registryHealth: ComponentHealth =
      registeredEntries === 0
        ? { status: "unknown", details: { reason: "no Sources/Policies/Permissions registered" } }
        : { status: "healthy" };

    const catalogCount = this.catalog.count();
    const catalogHealth: ComponentHealth =
      catalogCount === 0
        ? { status: "unknown", details: { reason: "Catalog has no entries" } }
        : { status: "healthy", details: { count: catalogCount } };

    return {
      status: worstOf(registryHealth.status, catalogHealth.status),
      registry: registryHealth,
      catalog: catalogHealth,
    };
  }
}
