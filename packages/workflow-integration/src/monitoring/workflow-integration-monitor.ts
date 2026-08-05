import type { WorkflowIntegrationHealthReport } from "../health/i-health-check.js";
import { WorkflowIntegrationHealth } from "../health/workflow-integration-health.js";
import type {
  IWorkflowIntegrationMetrics,
  WorkflowIntegrationMetricsSnapshot,
} from "../metrics/i-workflow-integration-metrics.js";
import type { WorkflowIntegrationRegistry } from "../registry/workflow-integration-registry.js";

/** "MONITORING: Integration Dashboard, Adapter Health, Latency, Error Rate, Retry Rate, Tenant Usage." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md). */
export interface IntegrationDashboard {
  readonly metrics: WorkflowIntegrationMetricsSnapshot;
  readonly health: WorkflowIntegrationHealthReport;
  readonly errorRate: number;
  readonly retryRate: number;
  readonly averageLatencyMs: number;
  readonly sampledAt: string;
}

/** Combines Metrics + Health into one sampled `IntegrationDashboard` snapshot. */
export class WorkflowIntegrationMonitor {
  readonly health: WorkflowIntegrationHealth;

  constructor(
    private readonly metrics: IWorkflowIntegrationMetrics,
    registry: WorkflowIntegrationRegistry,
  ) {
    this.health = new WorkflowIntegrationHealth(registry, () => this.metrics.snapshot());
  }

  sample(): IntegrationDashboard {
    const snapshot = this.metrics.snapshot();
    const totalFinished = snapshot.completed + snapshot.failures;
    return {
      metrics: snapshot,
      health: this.health.check(),
      errorRate: totalFinished === 0 ? 0 : snapshot.failures / totalFinished,
      retryRate: snapshot.integrations === 0 ? 0 : snapshot.retries / snapshot.integrations,
      averageLatencyMs: snapshot.averageDurationMs,
      sampledAt: new Date().toISOString(),
    };
  }
}
