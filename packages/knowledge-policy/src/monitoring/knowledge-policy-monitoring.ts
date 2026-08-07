import type { KnowledgePolicyHealthReport } from "../health/i-health-check.js";
import { KnowledgePolicyHealth } from "../health/knowledge-policy-health.js";
import type {
  IKnowledgePolicyMetricsCollector,
  KnowledgePolicyMetricsSnapshot,
} from "../metrics/i-knowledge-policy-metrics-collector.js";
import type { KnowledgePolicyRegistry } from "../registry/knowledge-policy-registry.js";

export interface KnowledgePolicyDashboard {
  readonly metrics: KnowledgePolicyMetricsSnapshot;
  readonly health: KnowledgePolicyHealthReport;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `KnowledgePolicyDashboard` snapshot. */
export class KnowledgePolicyMonitoring {
  readonly health: KnowledgePolicyHealth;

  constructor(
    private readonly metrics: IKnowledgePolicyMetricsCollector,
    registry: KnowledgePolicyRegistry,
  ) {
    this.health = new KnowledgePolicyHealth(registry);
  }

  sample(): KnowledgePolicyDashboard {
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
