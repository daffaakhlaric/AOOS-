/**
 * "METRICS: Source Count, Provider Count, Workspace Count, Tenant Count, Namespace
 * Count, Collection Count, Sync Enabled Count, Schedule Count, Policy Count, Permission
 * Count." (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md) — the exact 10-field list
 * from the prompt.
 */
export interface KnowledgeSourceMetricsSnapshot {
  readonly sourceCount: number;
  readonly providerCount: number;
  readonly workspaceCount: number;
  readonly tenantCount: number;
  readonly namespaceCount: number;
  readonly collectionCount: number;
  readonly syncEnabledCount: number;
  readonly scheduleCount: number;
  readonly policyCount: number;
  readonly permissionCount: number;
}

/**
 * Named `...Collector` to avoid colliding with `contracts/i-knowledge-source-metrics.ts`'s
 * `IKnowledgeSourceMetrics` — that one is the Extension Point for an external pluggable
 * metrics sink; this one is the internal collector `KnowledgeSourceMetrics` implements.
 */
export interface IKnowledgeSourceMetricsCollector {
  setSourceCount(count: number): void;
  setProviderCount(count: number): void;
  setWorkspaceCount(count: number): void;
  setTenantCount(count: number): void;
  setNamespaceCount(count: number): void;
  setCollectionCount(count: number): void;
  setSyncEnabledCount(count: number): void;
  setScheduleCount(count: number): void;
  setPolicyCount(count: number): void;
  setPermissionCount(count: number): void;
  snapshot(): KnowledgeSourceMetricsSnapshot;
}
