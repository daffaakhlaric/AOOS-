import { KnowledgeSynchronizationMode } from "../domain/knowledge-synchronization-mode.js";

import type {
  IKnowledgeSynchronizationMetrics,
  KnowledgeSynchronizationMetricsSnapshot,
} from "./i-knowledge-synchronization-metrics.js";

function emptySynchronizationModeStatistics(): Record<KnowledgeSynchronizationMode, number> {
  const count = {} as Record<KnowledgeSynchronizationMode, number>;
  for (const mode of Object.values(KnowledgeSynchronizationMode)) {
    count[mode] = 0;
  }
  return count;
}

export class KnowledgeSynchronizationMetrics implements IKnowledgeSynchronizationMetrics {
  private synchronizationCount = 0;
  private successfulSynchronizations = 0;
  private failedSynchronizations = 0;
  private retryCount = 0;
  private totalDurationMs = 0;
  private durationSamples = 0;
  private queueLength = 0;
  private pendingJobs = 0;
  private readonly providerStatistics = new Map<string, number>();
  private readonly workspaceStatistics = new Map<string, number>();
  private readonly tenantStatistics = new Map<string, number>();
  private readonly synchronizationModeStatistics = emptySynchronizationModeStatistics();

  recordSynchronizationStarted(): void {
    this.synchronizationCount += 1;
  }

  recordSynchronizationCompleted(durationMs: number): void {
    this.successfulSynchronizations += 1;
    this.totalDurationMs += durationMs;
    this.durationSamples += 1;
  }

  recordSynchronizationFailed(): void {
    this.failedSynchronizations += 1;
  }

  recordRetry(): void {
    this.retryCount += 1;
  }

  setQueueLength(length: number): void {
    this.queueLength = length;
  }

  setPendingJobs(count: number): void {
    this.pendingJobs = count;
  }

  recordProviderUsage(providerId: string): void {
    this.providerStatistics.set(providerId, (this.providerStatistics.get(providerId) ?? 0) + 1);
  }

  recordWorkspaceUsage(workspaceId: string): void {
    this.workspaceStatistics.set(workspaceId, (this.workspaceStatistics.get(workspaceId) ?? 0) + 1);
  }

  recordTenantUsage(tenantId: string): void {
    this.tenantStatistics.set(tenantId, (this.tenantStatistics.get(tenantId) ?? 0) + 1);
  }

  recordSynchronizationMode(mode: KnowledgeSynchronizationMode): void {
    this.synchronizationModeStatistics[mode] += 1;
  }

  snapshot(): KnowledgeSynchronizationMetricsSnapshot {
    return {
      synchronizationCount: this.synchronizationCount,
      successfulSynchronizations: this.successfulSynchronizations,
      failedSynchronizations: this.failedSynchronizations,
      retryCount: this.retryCount,
      averageDurationMs:
        this.durationSamples === 0 ? 0 : this.totalDurationMs / this.durationSamples,
      queueLength: this.queueLength,
      pendingJobs: this.pendingJobs,
      providerStatistics: Object.fromEntries(this.providerStatistics),
      workspaceStatistics: Object.fromEntries(this.workspaceStatistics),
      tenantStatistics: Object.fromEntries(this.tenantStatistics),
      synchronizationModeStatistics: { ...this.synchronizationModeStatistics },
    };
  }
}
