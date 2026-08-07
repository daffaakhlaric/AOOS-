import type { KnowledgeGeneratorHealthReport } from "../health/i-health-check.js";
import { KnowledgeGeneratorHealth } from "../health/knowledge-generator-health.js";
import type {
  IKnowledgeGeneratorMetricsCollector,
  KnowledgeGeneratorMetricsSnapshot,
} from "../metrics/i-knowledge-generator-metrics-collector.js";
import type { KnowledgeGeneratorRegistry } from "../registry/knowledge-generator-registry.js";

export interface KnowledgeGeneratorDashboard {
  readonly metrics: KnowledgeGeneratorMetricsSnapshot;
  readonly health: KnowledgeGeneratorHealthReport;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `KnowledgeGeneratorDashboard` snapshot. */
export class KnowledgeGeneratorMonitoring {
  readonly health: KnowledgeGeneratorHealth;

  constructor(
    private readonly metrics: IKnowledgeGeneratorMetricsCollector,
    registry: KnowledgeGeneratorRegistry,
  ) {
    this.health = new KnowledgeGeneratorHealth(registry);
  }

  sample(): KnowledgeGeneratorDashboard {
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
