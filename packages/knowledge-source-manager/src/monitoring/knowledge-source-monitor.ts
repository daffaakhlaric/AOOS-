import type { KnowledgeSourceCatalog } from "../catalog/knowledge-source-catalog.js";
import type { KnowledgeSourceHealthReport } from "../health/i-health-check.js";
import { KnowledgeSourceHealth } from "../health/knowledge-source-health.js";
import type {
  IKnowledgeSourceMetricsCollector,
  KnowledgeSourceMetricsSnapshot,
} from "../metrics/i-knowledge-source-metrics-collector.js";
import type { KnowledgeSourceRegistry } from "../registry/knowledge-source-registry.js";

/**
 * "MONITORING: Source Dashboard, Workspace Dashboard, Tenant Dashboard, Namespace
 * Dashboard, Collection Dashboard, Provider Dashboard, Health Dashboard, Usage
 * Dashboard." (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md) — one combined sample
 * carrying all 8 named sections.
 */
export interface KnowledgeSourceDashboard {
  readonly source: { readonly count: number };
  readonly workspace: {
    readonly count: number;
    readonly sources: Readonly<Record<string, number>>;
  };
  readonly tenant: { readonly count: number; readonly sources: Readonly<Record<string, number>> };
  readonly namespace: { readonly count: number };
  readonly collection: { readonly count: number };
  readonly provider: { readonly count: number; readonly sources: Readonly<Record<string, number>> };
  readonly health: KnowledgeSourceHealthReport;
  readonly usage: { readonly syncEnabledCount: number; readonly scheduleCount: number };
  readonly metrics: KnowledgeSourceMetricsSnapshot;
  readonly sampledAt: string;
}

/** Combines Metrics + Health + Catalog dimension counts into one sampled `KnowledgeSourceDashboard` snapshot. */
export class KnowledgeSourceMonitor {
  readonly health: KnowledgeSourceHealth;

  constructor(
    private readonly metrics: IKnowledgeSourceMetricsCollector,
    registry: KnowledgeSourceRegistry,
    private readonly catalog: KnowledgeSourceCatalog,
  ) {
    this.health = new KnowledgeSourceHealth(registry, catalog);
  }

  sample(): KnowledgeSourceDashboard {
    const metrics = this.metrics.snapshot();
    const health = this.health.check();
    return {
      source: { count: metrics.sourceCount },
      workspace: {
        count: metrics.workspaceCount,
        sources: this.countBy((source) => source.workspaceId),
      },
      tenant: { count: metrics.tenantCount, sources: this.countBy((source) => source.tenantId) },
      namespace: { count: metrics.namespaceCount },
      collection: { count: metrics.collectionCount },
      provider: {
        count: metrics.providerCount,
        sources: this.countBy((source) => source.providerId),
      },
      health,
      usage: { syncEnabledCount: metrics.syncEnabledCount, scheduleCount: metrics.scheduleCount },
      metrics,
      sampledAt: new Date().toISOString(),
    };
  }

  private countBy(
    keyOf: (source: ReturnType<KnowledgeSourceCatalog["all"]>[number]) => string | undefined,
  ): Readonly<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const source of this.catalog.all()) {
      const key = keyOf(source);
      if (key === undefined) {
        continue;
      }
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }
}
