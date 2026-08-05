import type { KnowledgeSynchronizationMode } from "../domain/knowledge-synchronization-mode.js";

export interface KnowledgeSynchronizationMetricsSnapshot {
  readonly synchronizationCount: number;
  readonly successfulSynchronizations: number;
  readonly failedSynchronizations: number;
  readonly retryCount: number;
  readonly averageDurationMs: number;
  readonly queueLength: number;
  readonly pendingJobs: number;
  readonly providerStatistics: Readonly<Record<string, number>>;
  readonly workspaceStatistics: Readonly<Record<string, number>>;
  readonly tenantStatistics: Readonly<Record<string, number>>;
  readonly synchronizationModeStatistics: Readonly<Record<KnowledgeSynchronizationMode, number>>;
}

/** "METRICS: Synchronization Count, Successful Synchronization, Failed Synchronization, Retry Count, Average Duration, Queue Length, Pending Jobs, Provider Statistics, Workspace Statistics, Tenant Statistics, Synchronization Mode Statistics." (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md). */
export interface IKnowledgeSynchronizationMetrics {
  recordSynchronizationStarted(): void;
  recordSynchronizationCompleted(durationMs: number): void;
  recordSynchronizationFailed(): void;
  recordRetry(): void;
  setQueueLength(length: number): void;
  setPendingJobs(count: number): void;
  recordProviderUsage(providerId: string): void;
  recordWorkspaceUsage(workspaceId: string): void;
  recordTenantUsage(tenantId: string): void;
  recordSynchronizationMode(mode: KnowledgeSynchronizationMode): void;
  snapshot(): KnowledgeSynchronizationMetricsSnapshot;
}
