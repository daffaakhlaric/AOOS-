import type { KnowledgeIndexType } from "../domain/knowledge-index-type.js";

export interface KnowledgeIndexMetricsSnapshot {
  readonly indexCount: number;
  readonly buildCount: number;
  readonly buildFailures: number;
  readonly rebuildCount: number;
  readonly optimizeCount: number;
  readonly averageBuildTimeMs: number;
  readonly tenantUsage: Readonly<Record<string, number>>;
  readonly workspaceUsage: Readonly<Record<string, number>>;
  readonly entriesByType: Readonly<Record<KnowledgeIndexType, number>>;
}

/** Tracks every `KnowledgeIndexPipeline` outcome — Index Count, Build/Rebuild/Optimize counts, Build Failures, Tenant/Workspace Usage, per-`KnowledgeIndexType` Entry counts. */
export interface IKnowledgeIndexMetrics {
  recordEntryBuilt(indexType: KnowledgeIndexType): void;
  recordEntryRemoved(indexType: KnowledgeIndexType): void;
  recordBuildCompleted(buildTimeMs: number): void;
  recordBuildFailed(): void;
  recordRebuild(): void;
  recordOptimize(): void;
  recordTenantUsage(tenantId: string): void;
  recordWorkspaceUsage(workspaceId: string): void;
  snapshot(): KnowledgeIndexMetricsSnapshot;
}
