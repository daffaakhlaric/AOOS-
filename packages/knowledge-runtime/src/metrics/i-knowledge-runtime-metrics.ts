import type { KnowledgeRuntimeState } from "../domain/knowledge-runtime-state.js";

export interface KnowledgeRuntimeMetricsSnapshot {
  readonly runtimeCount: number;
  readonly activeRuntimeCount: number;
  readonly failedRuntimeCount: number;
  readonly suspendedRuntimeCount: number;
  readonly averageExecutionTimeMs: number;
  readonly averageLoadTimeMs: number;
  readonly validationFailures: number;
  readonly tenantUsage: Readonly<Record<string, number>>;
  readonly workspaceUsage: Readonly<Record<string, number>>;
  readonly lifecycleStatistics: Readonly<Record<KnowledgeRuntimeState, number>>;
}

/** "METRICS: Runtime Count, Active Runtime, Failed Runtime, Suspended Runtime, Execution Time, Load Time, Validation Failures, Tenant Usage, Workspace Usage, Lifecycle Statistics." (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md). */
export interface IKnowledgeRuntimeMetrics {
  recordInstanceCreated(): void;
  recordInstanceCompleted(executionTimeMs: number): void;
  recordInstanceFailed(): void;
  recordInstanceSuspended(): void;
  recordInstanceResumed(): void;
  recordLoadTime(ms: number): void;
  recordValidationFailure(): void;
  recordTenantUsage(tenantId: string): void;
  recordWorkspaceUsage(workspaceId: string): void;
  /** Maintains the `lifecycleStatistics` gauge: decrements `from` (when supplied), increments `to`. */
  recordStateChange(to: KnowledgeRuntimeState, from?: KnowledgeRuntimeState): void;
  snapshot(): KnowledgeRuntimeMetricsSnapshot;
}
