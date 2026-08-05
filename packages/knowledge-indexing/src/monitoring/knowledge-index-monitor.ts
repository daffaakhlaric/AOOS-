import type { KnowledgeIndexHealthReport } from "../health/i-health-check.js";
import { KnowledgeIndexHealth } from "../health/knowledge-index-health.js";
import type {
  IKnowledgeIndexMetrics,
  KnowledgeIndexMetricsSnapshot,
} from "../metrics/i-knowledge-index-metrics.js";
import type { KnowledgeIndexRegistry } from "../registry/knowledge-index-registry.js";

export interface KnowledgeIndexDashboard {
  readonly index: {
    readonly count: number;
    readonly entriesByType: Readonly<Record<string, number>>;
  };
  readonly build: {
    readonly count: number;
    readonly failures: number;
    readonly averageBuildTimeMs: number;
  };
  readonly tenant: { readonly usage: Readonly<Record<string, number>> };
  readonly workspace: { readonly usage: Readonly<Record<string, number>> };
  readonly health: KnowledgeIndexHealthReport;
  readonly metrics: KnowledgeIndexMetricsSnapshot;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `KnowledgeIndexDashboard` snapshot. */
export class KnowledgeIndexMonitor {
  readonly health: KnowledgeIndexHealth;

  constructor(
    private readonly metrics: IKnowledgeIndexMetrics,
    registry: KnowledgeIndexRegistry,
  ) {
    this.health = new KnowledgeIndexHealth(registry, () => this.metrics.snapshot());
  }

  sample(): KnowledgeIndexDashboard {
    const metrics = this.metrics.snapshot();
    const health = this.health.check();
    return {
      index: { count: metrics.indexCount, entriesByType: metrics.entriesByType },
      build: {
        count: metrics.buildCount,
        failures: metrics.buildFailures,
        averageBuildTimeMs: metrics.averageBuildTimeMs,
      },
      tenant: { usage: metrics.tenantUsage },
      workspace: { usage: metrics.workspaceUsage },
      health,
      metrics,
      sampledAt: new Date().toISOString(),
    };
  }
}
