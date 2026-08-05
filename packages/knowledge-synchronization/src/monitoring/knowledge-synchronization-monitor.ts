import type { KnowledgeSynchronizationHealthReport } from "../health/i-health-check.js";
import { KnowledgeSynchronizationHealth } from "../health/knowledge-synchronization-health.js";
import type {
  IKnowledgeSynchronizationMetrics,
  KnowledgeSynchronizationMetricsSnapshot,
} from "../metrics/i-knowledge-synchronization-metrics.js";
import type { KnowledgeSynchronizationRegistry } from "../registry/knowledge-synchronization-registry.js";

/** "MONITORING: Synchronization Dashboard, Provider Dashboard, Job Dashboard, Queue Dashboard, Failure Dashboard, Retry Dashboard, Performance Dashboard, Workspace Dashboard, Tenant Dashboard." (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — one combined sample carrying all 9 named sections. */
export interface KnowledgeSynchronizationDashboard {
  readonly synchronization: {
    readonly total: number;
    readonly successful: number;
    readonly failed: number;
  };
  readonly provider: { readonly usage: Readonly<Record<string, number>> };
  readonly job: { readonly synchronizationModeStatistics: Readonly<Record<string, number>> };
  readonly queue: { readonly length: number; readonly pendingJobs: number };
  readonly failure: { readonly failed: number; readonly failureRatio: number };
  readonly retry: { readonly retryCount: number };
  readonly performance: { readonly averageDurationMs: number };
  readonly workspace: { readonly usage: Readonly<Record<string, number>> };
  readonly tenant: { readonly usage: Readonly<Record<string, number>> };
  readonly health: KnowledgeSynchronizationHealthReport;
  readonly metrics: KnowledgeSynchronizationMetricsSnapshot;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `KnowledgeSynchronizationDashboard` snapshot. */
export class KnowledgeSynchronizationMonitor {
  readonly health: KnowledgeSynchronizationHealth;

  constructor(
    private readonly metrics: IKnowledgeSynchronizationMetrics,
    registry: KnowledgeSynchronizationRegistry,
  ) {
    this.health = new KnowledgeSynchronizationHealth(registry, () => this.metrics.snapshot());
  }

  sample(): KnowledgeSynchronizationDashboard {
    const metrics = this.metrics.snapshot();
    const health = this.health.check();
    const failureRatio =
      metrics.synchronizationCount === 0
        ? 0
        : metrics.failedSynchronizations / metrics.synchronizationCount;
    return {
      synchronization: {
        total: metrics.synchronizationCount,
        successful: metrics.successfulSynchronizations,
        failed: metrics.failedSynchronizations,
      },
      provider: { usage: metrics.providerStatistics },
      job: { synchronizationModeStatistics: metrics.synchronizationModeStatistics },
      queue: { length: metrics.queueLength, pendingJobs: metrics.pendingJobs },
      failure: { failed: metrics.failedSynchronizations, failureRatio },
      retry: { retryCount: metrics.retryCount },
      performance: { averageDurationMs: metrics.averageDurationMs },
      workspace: { usage: metrics.workspaceStatistics },
      tenant: { usage: metrics.tenantStatistics },
      health,
      metrics,
      sampledAt: new Date().toISOString(),
    };
  }
}
