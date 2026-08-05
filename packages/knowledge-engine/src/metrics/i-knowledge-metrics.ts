/** "METRICS: Knowledge Count, Workspace Count, Library Count, Document Count, Template Count, Policy Count, Relationship Count, Version Count, Validation Errors, Tenant Usage, Department Usage, Storage Statistics." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md). */
export interface KnowledgeMetricsSnapshot {
  readonly knowledgeCount: number;
  readonly workspaceCount: number;
  readonly libraryCount: number;
  readonly documentCount: number;
  readonly templateCount: number;
  readonly policyCount: number;
  readonly relationshipCount: number;
  readonly versionCount: number;
  readonly validationErrors: number;
  readonly tenantUsage: Readonly<Record<string, number>>;
  readonly departmentUsage: Readonly<Record<string, number>>;
  readonly storageBytes: number;
}

export interface IKnowledgeMetrics {
  recordAssetCreated(isDocument: boolean): void;
  recordWorkspaceCreated(): void;
  recordLibraryCreated(): void;
  recordTemplateRegistered(): void;
  recordPolicyRegistered(): void;
  recordRelationshipCreated(): void;
  recordVersionCreated(): void;
  recordValidationError(): void;
  recordTenantUsage(tenantId: string): void;
  recordDepartmentUsage(departmentId: string): void;
  recordStorageBytes(bytes: number): void;
  snapshot(): KnowledgeMetricsSnapshot;
}
