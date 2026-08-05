import { KnowledgeRuntimeState } from "../domain/knowledge-runtime-state.js";

import type {
  IKnowledgeRuntimeMetrics,
  KnowledgeRuntimeMetricsSnapshot,
} from "./i-knowledge-runtime-metrics.js";

function emptyLifecycleStatistics(): Record<KnowledgeRuntimeState, number> {
  const count = {} as Record<KnowledgeRuntimeState, number>;
  for (const state of Object.values(KnowledgeRuntimeState)) {
    count[state] = 0;
  }
  return count;
}

export class KnowledgeRuntimeMetrics implements IKnowledgeRuntimeMetrics {
  private runtimeCount = 0;
  private activeRuntimeCount = 0;
  private failedRuntimeCount = 0;
  private suspendedRuntimeCount = 0;
  private totalExecutionTimeMs = 0;
  private completedSamples = 0;
  private totalLoadTimeMs = 0;
  private loadSamples = 0;
  private validationFailures = 0;
  private readonly tenantUsage = new Map<string, number>();
  private readonly workspaceUsage = new Map<string, number>();
  private readonly lifecycleStatistics = emptyLifecycleStatistics();

  recordInstanceCreated(): void {
    this.runtimeCount += 1;
    this.activeRuntimeCount += 1;
  }

  recordInstanceCompleted(executionTimeMs: number): void {
    this.totalExecutionTimeMs += executionTimeMs;
    this.completedSamples += 1;
    this.activeRuntimeCount = Math.max(0, this.activeRuntimeCount - 1);
  }

  recordInstanceFailed(): void {
    this.failedRuntimeCount += 1;
    this.activeRuntimeCount = Math.max(0, this.activeRuntimeCount - 1);
  }

  recordInstanceSuspended(): void {
    this.suspendedRuntimeCount += 1;
  }

  recordInstanceResumed(): void {
    this.suspendedRuntimeCount = Math.max(0, this.suspendedRuntimeCount - 1);
  }

  recordLoadTime(ms: number): void {
    this.totalLoadTimeMs += ms;
    this.loadSamples += 1;
  }

  recordValidationFailure(): void {
    this.validationFailures += 1;
  }

  recordTenantUsage(tenantId: string): void {
    this.tenantUsage.set(tenantId, (this.tenantUsage.get(tenantId) ?? 0) + 1);
  }

  recordWorkspaceUsage(workspaceId: string): void {
    this.workspaceUsage.set(workspaceId, (this.workspaceUsage.get(workspaceId) ?? 0) + 1);
  }

  recordStateChange(to: KnowledgeRuntimeState, from?: KnowledgeRuntimeState): void {
    if (from !== undefined) {
      this.lifecycleStatistics[from] = Math.max(0, this.lifecycleStatistics[from] - 1);
    }
    this.lifecycleStatistics[to] += 1;
  }

  snapshot(): KnowledgeRuntimeMetricsSnapshot {
    return {
      runtimeCount: this.runtimeCount,
      activeRuntimeCount: this.activeRuntimeCount,
      failedRuntimeCount: this.failedRuntimeCount,
      suspendedRuntimeCount: this.suspendedRuntimeCount,
      averageExecutionTimeMs:
        this.completedSamples === 0 ? 0 : this.totalExecutionTimeMs / this.completedSamples,
      averageLoadTimeMs: this.loadSamples === 0 ? 0 : this.totalLoadTimeMs / this.loadSamples,
      validationFailures: this.validationFailures,
      tenantUsage: Object.fromEntries(this.tenantUsage),
      workspaceUsage: Object.fromEntries(this.workspaceUsage),
      lifecycleStatistics: { ...this.lifecycleStatistics },
    };
  }
}
