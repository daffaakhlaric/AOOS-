import type { KnowledgeVersionHealthReport } from "../health/i-health-check.js";
import { KnowledgeVersionHealth } from "../health/knowledge-version-health.js";
import type {
  IKnowledgeVersionMetricsCollector,
  KnowledgeVersionMetricsSnapshot,
} from "../metrics/i-knowledge-version-metrics-collector.js";
import type { KnowledgeVersionRegistry } from "../registry/knowledge-version-registry.js";

/**
 * "MONITORING: Implement: Metrics, Health, Monitoring, Statistics. No external
 * telemetry." (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md) — one combined sample carrying
 * a Metrics snapshot + a Health report. Exact name `KnowledgeVersionMonitoring`, NOT
 * `...Monitor`, per the prompt's Public API list.
 */
export interface KnowledgeVersionDashboard {
  readonly metrics: KnowledgeVersionMetricsSnapshot;
  readonly health: KnowledgeVersionHealthReport;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `KnowledgeVersionDashboard` snapshot. */
export class KnowledgeVersionMonitoring {
  readonly health: KnowledgeVersionHealth;

  constructor(
    private readonly metrics: IKnowledgeVersionMetricsCollector,
    registry: KnowledgeVersionRegistry,
  ) {
    this.health = new KnowledgeVersionHealth(registry);
  }

  sample(): KnowledgeVersionDashboard {
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
