import { EmbeddingHealth } from "../health/embedding-health.js";
import type { EmbeddingManagerHealthReport } from "../health/i-health-check.js";
import type {
  EmbeddingManagerMetricsSnapshot,
  IEmbeddingManagerMetricsCollector,
} from "../metrics/i-embedding-manager-metrics-collector.js";
import type { EmbeddingRegistry } from "../registry/embedding-registry.js";

export interface EmbeddingManagerDashboard {
  readonly metrics: EmbeddingManagerMetricsSnapshot;
  readonly health: EmbeddingManagerHealthReport;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `EmbeddingManagerDashboard` snapshot. */
export class EmbeddingMonitoring {
  readonly health: EmbeddingHealth;

  constructor(
    private readonly metrics: IEmbeddingManagerMetricsCollector,
    registry: EmbeddingRegistry,
  ) {
    this.health = new EmbeddingHealth(registry);
  }

  sample(): EmbeddingManagerDashboard {
    const metrics = this.metrics.snapshot();
    const health = this.health.check(
      metrics.checkCount - metrics.checkFailureCount,
      metrics.checkFailureCount,
    );
    return { metrics, health, sampledAt: new Date().toISOString() };
  }
}
