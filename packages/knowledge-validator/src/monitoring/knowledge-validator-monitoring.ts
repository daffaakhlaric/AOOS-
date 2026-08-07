import type { KnowledgeValidatorHealthReport } from "../health/i-health-check.js";
import { KnowledgeValidatorHealth } from "../health/knowledge-validator-health.js";
import type {
  IKnowledgeValidatorMetricsCollector,
  KnowledgeValidatorMetricsSnapshot,
} from "../metrics/i-knowledge-validator-metrics-collector.js";
import type { KnowledgeValidatorRegistry } from "../registry/knowledge-validator-registry.js";

export interface KnowledgeValidatorDashboard {
  readonly metrics: KnowledgeValidatorMetricsSnapshot;
  readonly health: KnowledgeValidatorHealthReport;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `KnowledgeValidatorDashboard` snapshot. */
export class KnowledgeValidatorMonitoring {
  readonly health: KnowledgeValidatorHealth;

  constructor(
    private readonly metrics: IKnowledgeValidatorMetricsCollector,
    registry: KnowledgeValidatorRegistry,
  ) {
    this.health = new KnowledgeValidatorHealth(registry);
  }

  sample(): KnowledgeValidatorDashboard {
    const metrics = this.metrics.snapshot();
    const health = this.health.check(
      metrics.checkCount - metrics.checkFailureCount,
      metrics.checkFailureCount,
    );
    return {
      metrics,
      health,
      sampledAt: new Date().toISOString(),
    };
  }
}
