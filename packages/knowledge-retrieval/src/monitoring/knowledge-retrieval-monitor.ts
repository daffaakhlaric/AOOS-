import type { KnowledgeRetrievalHealthReport } from "../health/i-health-check.js";
import { KnowledgeRetrievalHealth } from "../health/knowledge-retrieval-health.js";
import type {
  IKnowledgeRetrievalMetrics,
  KnowledgeRetrievalMetricsSnapshot,
} from "../metrics/i-knowledge-retrieval-metrics.js";
import type { KnowledgeRetrievalRegistry } from "../registry/knowledge-retrieval-registry.js";

/** "MONITORING: Search Dashboard, Ranking Dashboard, Latency Dashboard, Workspace Dashboard, Permission Dashboard, Policy Dashboard, Usage Dashboard." (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — one combined sample carrying all 7 named sections. */
export interface KnowledgeRetrievalDashboard {
  readonly search: { readonly total: number; readonly successful: number; readonly failed: number };
  readonly ranking: { readonly averageMs: number };
  readonly latency: { readonly averageMs: number; readonly averageFilterMs: number };
  readonly workspace: { readonly usage: Readonly<Record<string, number>> };
  readonly permission: { readonly rejectCount: number };
  readonly policy: { readonly rejectCount: number };
  readonly usage: { readonly tenantUsage: Readonly<Record<string, number>> };
  readonly health: KnowledgeRetrievalHealthReport;
  readonly metrics: KnowledgeRetrievalMetricsSnapshot;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `KnowledgeRetrievalDashboard` snapshot. */
export class KnowledgeRetrievalMonitor {
  readonly health: KnowledgeRetrievalHealth;

  constructor(
    private readonly metrics: IKnowledgeRetrievalMetrics,
    registry: KnowledgeRetrievalRegistry,
  ) {
    this.health = new KnowledgeRetrievalHealth(registry, () => this.metrics.snapshot());
  }

  sample(): KnowledgeRetrievalDashboard {
    const metrics = this.metrics.snapshot();
    const health = this.health.check();
    return {
      search: {
        total: metrics.totalQueries,
        successful: metrics.successfulQueries,
        failed: metrics.failedQueries,
      },
      ranking: { averageMs: metrics.averageRankingTimeMs },
      latency: {
        averageMs: metrics.averageLatencyMs,
        averageFilterMs: metrics.averageFilterTimeMs,
      },
      workspace: { usage: metrics.workspaceUsage },
      permission: { rejectCount: metrics.permissionRejectCount },
      policy: { rejectCount: metrics.policyRejectCount },
      usage: { tenantUsage: metrics.tenantUsage },
      health,
      metrics,
      sampledAt: new Date().toISOString(),
    };
  }
}
