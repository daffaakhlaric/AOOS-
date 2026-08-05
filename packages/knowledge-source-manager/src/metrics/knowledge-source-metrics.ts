import type {
  IKnowledgeSourceMetricsCollector,
  KnowledgeSourceMetricsSnapshot,
} from "./i-knowledge-source-metrics-collector.js";

/** "KnowledgeSourceMetrics" (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md — "PUBLIC API") — a live in-memory snapshot of the 10 named counters, set by `KnowledgeSourceManager`/`KnowledgeSourcePipeline` whenever the underlying Registry/Catalog counts change. */
export class KnowledgeSourceMetrics implements IKnowledgeSourceMetricsCollector {
  private sourceCount = 0;
  private providerCount = 0;
  private workspaceCount = 0;
  private tenantCount = 0;
  private namespaceCount = 0;
  private collectionCount = 0;
  private syncEnabledCount = 0;
  private scheduleCount = 0;
  private policyCount = 0;
  private permissionCount = 0;

  setSourceCount(count: number): void {
    this.sourceCount = count;
  }

  setProviderCount(count: number): void {
    this.providerCount = count;
  }

  setWorkspaceCount(count: number): void {
    this.workspaceCount = count;
  }

  setTenantCount(count: number): void {
    this.tenantCount = count;
  }

  setNamespaceCount(count: number): void {
    this.namespaceCount = count;
  }

  setCollectionCount(count: number): void {
    this.collectionCount = count;
  }

  setSyncEnabledCount(count: number): void {
    this.syncEnabledCount = count;
  }

  setScheduleCount(count: number): void {
    this.scheduleCount = count;
  }

  setPolicyCount(count: number): void {
    this.policyCount = count;
  }

  setPermissionCount(count: number): void {
    this.permissionCount = count;
  }

  snapshot(): KnowledgeSourceMetricsSnapshot {
    return {
      sourceCount: this.sourceCount,
      providerCount: this.providerCount,
      workspaceCount: this.workspaceCount,
      tenantCount: this.tenantCount,
      namespaceCount: this.namespaceCount,
      collectionCount: this.collectionCount,
      syncEnabledCount: this.syncEnabledCount,
      scheduleCount: this.scheduleCount,
      policyCount: this.policyCount,
      permissionCount: this.permissionCount,
    };
  }
}
