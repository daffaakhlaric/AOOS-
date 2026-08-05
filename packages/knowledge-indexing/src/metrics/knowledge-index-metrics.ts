import { KnowledgeIndexType } from "../domain/knowledge-index-type.js";

import type {
  IKnowledgeIndexMetrics,
  KnowledgeIndexMetricsSnapshot,
} from "./i-knowledge-index-metrics.js";

function emptyEntriesByType(): Record<KnowledgeIndexType, number> {
  const count = {} as Record<KnowledgeIndexType, number>;
  for (const indexType of Object.values(KnowledgeIndexType)) {
    count[indexType] = 0;
  }
  return count;
}

export class KnowledgeIndexMetrics implements IKnowledgeIndexMetrics {
  private buildCount = 0;
  private buildFailures = 0;
  private rebuildCount = 0;
  private optimizeCount = 0;
  private totalBuildTimeMs = 0;
  private buildSamples = 0;
  private readonly tenantUsage = new Map<string, number>();
  private readonly workspaceUsage = new Map<string, number>();
  private readonly entriesByType = emptyEntriesByType();

  recordEntryBuilt(indexType: KnowledgeIndexType): void {
    this.entriesByType[indexType] += 1;
  }

  recordEntryRemoved(indexType: KnowledgeIndexType): void {
    this.entriesByType[indexType] = Math.max(0, this.entriesByType[indexType] - 1);
  }

  recordBuildCompleted(buildTimeMs: number): void {
    this.buildCount += 1;
    this.totalBuildTimeMs += buildTimeMs;
    this.buildSamples += 1;
  }

  recordBuildFailed(): void {
    this.buildFailures += 1;
  }

  recordRebuild(): void {
    this.rebuildCount += 1;
  }

  recordOptimize(): void {
    this.optimizeCount += 1;
  }

  recordTenantUsage(tenantId: string): void {
    this.tenantUsage.set(tenantId, (this.tenantUsage.get(tenantId) ?? 0) + 1);
  }

  recordWorkspaceUsage(workspaceId: string): void {
    this.workspaceUsage.set(workspaceId, (this.workspaceUsage.get(workspaceId) ?? 0) + 1);
  }

  snapshot(): KnowledgeIndexMetricsSnapshot {
    const indexCount = Object.values(this.entriesByType).reduce((total, count) => total + count, 0);
    return {
      indexCount,
      buildCount: this.buildCount,
      buildFailures: this.buildFailures,
      rebuildCount: this.rebuildCount,
      optimizeCount: this.optimizeCount,
      averageBuildTimeMs: this.buildSamples === 0 ? 0 : this.totalBuildTimeMs / this.buildSamples,
      tenantUsage: Object.fromEntries(this.tenantUsage),
      workspaceUsage: Object.fromEntries(this.workspaceUsage),
      entriesByType: { ...this.entriesByType },
    };
  }
}
