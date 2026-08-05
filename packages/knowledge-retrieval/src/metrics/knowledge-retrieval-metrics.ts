import { KnowledgeSearchMode } from "../domain/knowledge-search-mode.js";

import type {
  IKnowledgeRetrievalMetrics,
  KnowledgeRetrievalMetricsSnapshot,
} from "./i-knowledge-retrieval-metrics.js";

function emptySearchModeStatistics(): Record<KnowledgeSearchMode, number> {
  const count = {} as Record<KnowledgeSearchMode, number>;
  for (const mode of Object.values(KnowledgeSearchMode)) {
    count[mode] = 0;
  }
  return count;
}

export class KnowledgeRetrievalMetrics implements IKnowledgeRetrievalMetrics {
  private totalQueries = 0;
  private successfulQueries = 0;
  private failedQueries = 0;
  private totalLatencyMs = 0;
  private latencySamples = 0;
  private totalRankingTimeMs = 0;
  private rankingSamples = 0;
  private totalFilterTimeMs = 0;
  private filterSamples = 0;
  private permissionRejectCount = 0;
  private policyRejectCount = 0;
  private readonly workspaceUsage = new Map<string, number>();
  private readonly tenantUsage = new Map<string, number>();
  private readonly searchModeStatistics = emptySearchModeStatistics();

  recordQueryStarted(): void {
    this.totalQueries += 1;
  }

  recordQueryCompleted(latencyMs: number): void {
    this.successfulQueries += 1;
    this.totalLatencyMs += latencyMs;
    this.latencySamples += 1;
  }

  recordQueryFailed(): void {
    this.failedQueries += 1;
  }

  recordRankingTime(ms: number): void {
    this.totalRankingTimeMs += ms;
    this.rankingSamples += 1;
  }

  recordFilterTime(ms: number): void {
    this.totalFilterTimeMs += ms;
    this.filterSamples += 1;
  }

  recordPermissionReject(count: number): void {
    this.permissionRejectCount += count;
  }

  recordPolicyReject(count: number): void {
    this.policyRejectCount += count;
  }

  recordWorkspaceUsage(workspaceId: string): void {
    this.workspaceUsage.set(workspaceId, (this.workspaceUsage.get(workspaceId) ?? 0) + 1);
  }

  recordTenantUsage(tenantId: string): void {
    this.tenantUsage.set(tenantId, (this.tenantUsage.get(tenantId) ?? 0) + 1);
  }

  recordSearchMode(mode: KnowledgeSearchMode): void {
    this.searchModeStatistics[mode] += 1;
  }

  snapshot(): KnowledgeRetrievalMetricsSnapshot {
    return {
      totalQueries: this.totalQueries,
      successfulQueries: this.successfulQueries,
      failedQueries: this.failedQueries,
      averageLatencyMs: this.latencySamples === 0 ? 0 : this.totalLatencyMs / this.latencySamples,
      averageRankingTimeMs:
        this.rankingSamples === 0 ? 0 : this.totalRankingTimeMs / this.rankingSamples,
      averageFilterTimeMs:
        this.filterSamples === 0 ? 0 : this.totalFilterTimeMs / this.filterSamples,
      permissionRejectCount: this.permissionRejectCount,
      policyRejectCount: this.policyRejectCount,
      workspaceUsage: Object.fromEntries(this.workspaceUsage),
      tenantUsage: Object.fromEntries(this.tenantUsage),
      searchModeStatistics: { ...this.searchModeStatistics },
    };
  }
}
