/** "METRICS: Integrations, Resolution Time, Failures, Retries, Timeouts, Adapter Usage, Health, Tenant Usage." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md). */
export interface WorkflowIntegrationMetricsSnapshot {
  readonly integrations: number;
  readonly completed: number;
  readonly failures: number;
  readonly retries: number;
  readonly timeouts: number;
  readonly averageResolutionTimeMs: number;
  readonly averageDurationMs: number;
  readonly adapterUsage: Readonly<Record<string, number>>;
  readonly tenantUsage: Readonly<Record<string, number>>;
}

export interface IWorkflowIntegrationMetrics {
  recordIntegrationStarted(): void;
  recordIntegrationCompleted(durationMs: number): void;
  recordIntegrationFailed(): void;
  recordResolutionTime(ms: number): void;
  recordRetry(): void;
  recordTimeout(): void;
  recordAdapterUsage(adapterName: string): void;
  recordTenantUsage(tenantId: string): void;
  snapshot(): WorkflowIntegrationMetricsSnapshot;
}
