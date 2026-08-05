import type { HealthStatus, KnowledgeRuntimeHealthReport } from "../health/i-health-check.js";
import { KnowledgeRuntimeHealth } from "../health/knowledge-runtime-health.js";
import type {
  IKnowledgeRuntimeMetrics,
  KnowledgeRuntimeMetricsSnapshot,
} from "../metrics/i-knowledge-runtime-metrics.js";
import type { KnowledgeRuntimeRegistry } from "../registry/knowledge-runtime-registry.js";

/** "MONITORING: Runtime Dashboard, Execution Dashboard, Lifecycle Dashboard, Validation Dashboard, Tenant Dashboard, Workspace Dashboard, Performance Dashboard." (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — one combined sample carrying all 7 named sections. */
export interface KnowledgeRuntimeDashboard {
  readonly runtime: { readonly count: number; readonly active: number };
  readonly execution: { readonly completed: number; readonly failed: number };
  readonly lifecycle: { readonly statistics: Readonly<Record<string, number>> };
  readonly validation: { readonly failures: number; readonly status: HealthStatus };
  readonly tenant: { readonly usage: Readonly<Record<string, number>> };
  readonly workspace: { readonly usage: Readonly<Record<string, number>> };
  readonly performance: {
    readonly averageExecutionTimeMs: number;
    readonly averageLoadTimeMs: number;
  };
  readonly health: KnowledgeRuntimeHealthReport;
  readonly metrics: KnowledgeRuntimeMetricsSnapshot;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `KnowledgeRuntimeDashboard` snapshot. */
export class KnowledgeRuntimeMonitor {
  readonly health: KnowledgeRuntimeHealth;

  constructor(
    private readonly metrics: IKnowledgeRuntimeMetrics,
    registry: KnowledgeRuntimeRegistry,
  ) {
    this.health = new KnowledgeRuntimeHealth(registry, () => this.metrics.snapshot());
  }

  sample(): KnowledgeRuntimeDashboard {
    const metrics = this.metrics.snapshot();
    const health = this.health.check();
    return {
      runtime: { count: metrics.runtimeCount, active: metrics.activeRuntimeCount },
      execution: {
        completed: metrics.runtimeCount - metrics.activeRuntimeCount - metrics.failedRuntimeCount,
        failed: metrics.failedRuntimeCount,
      },
      lifecycle: { statistics: metrics.lifecycleStatistics },
      validation: { failures: metrics.validationFailures, status: health.validation.status },
      tenant: { usage: metrics.tenantUsage },
      workspace: { usage: metrics.workspaceUsage },
      performance: {
        averageExecutionTimeMs: metrics.averageExecutionTimeMs,
        averageLoadTimeMs: metrics.averageLoadTimeMs,
      },
      health,
      metrics,
      sampledAt: new Date().toISOString(),
    };
  }
}
