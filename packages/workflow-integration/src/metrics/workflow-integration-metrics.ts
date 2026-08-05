import type {
  IWorkflowIntegrationMetrics,
  WorkflowIntegrationMetricsSnapshot,
} from "./i-workflow-integration-metrics.js";

/** The concrete `IWorkflowIntegrationMetrics` collector — exported directly per the Public API list. */
export class WorkflowIntegrationMetrics implements IWorkflowIntegrationMetrics {
  private integrations = 0;
  private completed = 0;
  private failures = 0;
  private retries = 0;
  private timeouts = 0;
  private totalResolutionTimeMs = 0;
  private resolutionSamples = 0;
  private totalDurationMs = 0;
  private durationSamples = 0;
  private readonly adapterUsage = new Map<string, number>();
  private readonly tenantUsage = new Map<string, number>();

  recordIntegrationStarted(): void {
    this.integrations += 1;
  }

  recordIntegrationCompleted(durationMs: number): void {
    this.completed += 1;
    this.totalDurationMs += durationMs;
    this.durationSamples += 1;
  }

  recordIntegrationFailed(): void {
    this.failures += 1;
  }

  recordResolutionTime(ms: number): void {
    this.totalResolutionTimeMs += ms;
    this.resolutionSamples += 1;
  }

  recordRetry(): void {
    this.retries += 1;
  }

  recordTimeout(): void {
    this.timeouts += 1;
  }

  recordAdapterUsage(adapterName: string): void {
    this.adapterUsage.set(adapterName, (this.adapterUsage.get(adapterName) ?? 0) + 1);
  }

  recordTenantUsage(tenantId: string): void {
    this.tenantUsage.set(tenantId, (this.tenantUsage.get(tenantId) ?? 0) + 1);
  }

  snapshot(): WorkflowIntegrationMetricsSnapshot {
    return {
      integrations: this.integrations,
      completed: this.completed,
      failures: this.failures,
      retries: this.retries,
      timeouts: this.timeouts,
      averageResolutionTimeMs:
        this.resolutionSamples === 0 ? 0 : this.totalResolutionTimeMs / this.resolutionSamples,
      averageDurationMs:
        this.durationSamples === 0 ? 0 : this.totalDurationMs / this.durationSamples,
      adapterUsage: Object.fromEntries(this.adapterUsage),
      tenantUsage: Object.fromEntries(this.tenantUsage),
    };
  }
}
