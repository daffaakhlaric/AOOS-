import type { KnowledgeMarketplaceHealthReport } from "../health/i-health-check.js";
import { KnowledgeMarketplaceHealth } from "../health/knowledge-marketplace-health.js";
import type {
  IKnowledgeMarketplaceMetricsCollector,
  KnowledgeMarketplaceMetricsSnapshot,
} from "../metrics/i-knowledge-marketplace-metrics-collector.js";
import type { KnowledgeMarketplaceRegistry } from "../registry/knowledge-marketplace-registry.js";

export interface KnowledgeMarketplaceDashboard {
  readonly metrics: KnowledgeMarketplaceMetricsSnapshot;
  readonly health: KnowledgeMarketplaceHealthReport;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `KnowledgeMarketplaceDashboard` snapshot. */
export class KnowledgeMarketplaceMonitoring {
  readonly health: KnowledgeMarketplaceHealth;

  constructor(
    private readonly metrics: IKnowledgeMarketplaceMetricsCollector,
    registry: KnowledgeMarketplaceRegistry,
  ) {
    this.health = new KnowledgeMarketplaceHealth(registry);
  }

  sample(): KnowledgeMarketplaceDashboard {
    const metrics = this.metrics.snapshot();
    const health = this.health.check(
      metrics.validationCount - metrics.validationFailureCount,
      metrics.validationFailureCount,
    );
    return {
      metrics,
      health,
      sampledAt: new Date().toISOString(),
    };
  }
}
