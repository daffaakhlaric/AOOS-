import type { IKnowledgeMetrics, KnowledgeMetricsSnapshot } from "./i-knowledge-metrics.js";

/** The concrete `IKnowledgeMetrics` collector — exported directly per the Public API list. */
export class KnowledgeMetrics implements IKnowledgeMetrics {
  private knowledgeCount = 0;
  private workspaceCount = 0;
  private libraryCount = 0;
  private documentCount = 0;
  private templateCount = 0;
  private policyCount = 0;
  private relationshipCount = 0;
  private versionCount = 0;
  private validationErrors = 0;
  private storageBytes = 0;
  private readonly tenantUsage = new Map<string, number>();
  private readonly departmentUsage = new Map<string, number>();

  recordAssetCreated(isDocument: boolean): void {
    this.knowledgeCount += 1;
    if (isDocument) {
      this.documentCount += 1;
    }
  }

  recordWorkspaceCreated(): void {
    this.workspaceCount += 1;
  }

  recordLibraryCreated(): void {
    this.libraryCount += 1;
  }

  recordTemplateRegistered(): void {
    this.templateCount += 1;
  }

  recordPolicyRegistered(): void {
    this.policyCount += 1;
  }

  recordRelationshipCreated(): void {
    this.relationshipCount += 1;
  }

  recordVersionCreated(): void {
    this.versionCount += 1;
  }

  recordValidationError(): void {
    this.validationErrors += 1;
  }

  recordTenantUsage(tenantId: string): void {
    this.tenantUsage.set(tenantId, (this.tenantUsage.get(tenantId) ?? 0) + 1);
  }

  recordDepartmentUsage(departmentId: string): void {
    this.departmentUsage.set(departmentId, (this.departmentUsage.get(departmentId) ?? 0) + 1);
  }

  recordStorageBytes(bytes: number): void {
    this.storageBytes += bytes;
  }

  snapshot(): KnowledgeMetricsSnapshot {
    return {
      knowledgeCount: this.knowledgeCount,
      workspaceCount: this.workspaceCount,
      libraryCount: this.libraryCount,
      documentCount: this.documentCount,
      templateCount: this.templateCount,
      policyCount: this.policyCount,
      relationshipCount: this.relationshipCount,
      versionCount: this.versionCount,
      validationErrors: this.validationErrors,
      tenantUsage: Object.fromEntries(this.tenantUsage),
      departmentUsage: Object.fromEntries(this.departmentUsage),
      storageBytes: this.storageBytes,
    };
  }
}
