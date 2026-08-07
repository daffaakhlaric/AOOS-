import type { KnowledgeQualityHealthReport } from "../health/i-health-check.js";
import { KnowledgeQualityHealth } from "../health/knowledge-quality-health.js";
import type {
  IKnowledgeQualityMetricsCollector,
  KnowledgeQualityMetricsSnapshot,
} from "../metrics/i-knowledge-quality-metrics-collector.js";
import type { KnowledgeQualityRegistry } from "../registry/knowledge-quality-registry.js";

export interface KnowledgeQualityDashboard {
  readonly metrics: KnowledgeQualityMetricsSnapshot;
  readonly health: KnowledgeQualityHealthReport;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `KnowledgeQualityDashboard` snapshot. */
export class KnowledgeQualityMonitoring {
  readonly health: KnowledgeQualityHealth;

  constructor(
    private readonly metrics: IKnowledgeQualityMetricsCollector,
    registry: KnowledgeQualityRegistry,
  ) {
    this.health = new KnowledgeQualityHealth(registry);
  }

  sample(): KnowledgeQualityDashboard {
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
