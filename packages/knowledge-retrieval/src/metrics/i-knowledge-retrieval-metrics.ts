import type { KnowledgeSearchMode } from "../domain/knowledge-search-mode.js";

export interface KnowledgeRetrievalMetricsSnapshot {
  readonly totalQueries: number;
  readonly successfulQueries: number;
  readonly failedQueries: number;
  readonly averageLatencyMs: number;
  readonly averageRankingTimeMs: number;
  readonly averageFilterTimeMs: number;
  readonly permissionRejectCount: number;
  readonly policyRejectCount: number;
  readonly workspaceUsage: Readonly<Record<string, number>>;
  readonly tenantUsage: Readonly<Record<string, number>>;
  readonly searchModeStatistics: Readonly<Record<KnowledgeSearchMode, number>>;
}

/** "METRICS: Total Queries, Successful Queries, Failed Queries, Average Latency, Average Ranking Time, Average Filter Time, Permission Reject Count, Policy Reject Count, Workspace Usage, Tenant Usage, Search Mode Statistics." (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md). */
export interface IKnowledgeRetrievalMetrics {
  recordQueryStarted(): void;
  recordQueryCompleted(latencyMs: number): void;
  recordQueryFailed(): void;
  recordRankingTime(ms: number): void;
  recordFilterTime(ms: number): void;
  recordPermissionReject(count: number): void;
  recordPolicyReject(count: number): void;
  recordWorkspaceUsage(workspaceId: string): void;
  recordTenantUsage(tenantId: string): void;
  recordSearchMode(mode: KnowledgeSearchMode): void;
  snapshot(): KnowledgeRetrievalMetricsSnapshot;
}
