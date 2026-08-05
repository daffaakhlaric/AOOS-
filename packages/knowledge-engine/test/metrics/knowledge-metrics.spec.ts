import { describe, expect, it } from "vitest";

import { KnowledgeMetrics } from "../../src/metrics/knowledge-metrics.js";

describe("Metrics Test — KnowledgeMetrics", () => {
  it("starts every counter at zero", () => {
    const metrics = new KnowledgeMetrics();
    expect(metrics.snapshot()).toMatchObject({
      knowledgeCount: 0,
      workspaceCount: 0,
      libraryCount: 0,
      documentCount: 0,
      templateCount: 0,
      policyCount: 0,
      relationshipCount: 0,
      versionCount: 0,
      validationErrors: 0,
      storageBytes: 0,
      tenantUsage: {},
      departmentUsage: {},
    });
  });

  it("recordAssetCreated() increments knowledgeCount always, documentCount only when isDocument", () => {
    const metrics = new KnowledgeMetrics();
    metrics.recordAssetCreated(true);
    metrics.recordAssetCreated(false);
    const snapshot = metrics.snapshot();
    expect(snapshot.knowledgeCount).toBe(2);
    expect(snapshot.documentCount).toBe(1);
  });

  it("tracks Workspace/Library/Template/Policy/Relationship/Version counts", () => {
    const metrics = new KnowledgeMetrics();
    metrics.recordWorkspaceCreated();
    metrics.recordLibraryCreated();
    metrics.recordTemplateRegistered();
    metrics.recordPolicyRegistered();
    metrics.recordRelationshipCreated();
    metrics.recordVersionCreated();
    const snapshot = metrics.snapshot();
    expect(snapshot.workspaceCount).toBe(1);
    expect(snapshot.libraryCount).toBe(1);
    expect(snapshot.templateCount).toBe(1);
    expect(snapshot.policyCount).toBe(1);
    expect(snapshot.relationshipCount).toBe(1);
    expect(snapshot.versionCount).toBe(1);
  });

  it("tracks Validation Errors", () => {
    const metrics = new KnowledgeMetrics();
    metrics.recordValidationError();
    metrics.recordValidationError();
    expect(metrics.snapshot().validationErrors).toBe(2);
  });

  it("tracks Tenant Usage per tenantId", () => {
    const metrics = new KnowledgeMetrics();
    metrics.recordTenantUsage("tenant-1");
    metrics.recordTenantUsage("tenant-1");
    metrics.recordTenantUsage("tenant-2");
    expect(metrics.snapshot().tenantUsage).toEqual({ "tenant-1": 2, "tenant-2": 1 });
  });

  it("tracks Department Usage per departmentId", () => {
    const metrics = new KnowledgeMetrics();
    metrics.recordDepartmentUsage("dept-1");
    expect(metrics.snapshot().departmentUsage).toEqual({ "dept-1": 1 });
  });

  it("tracks Storage Statistics as accumulated bytes", () => {
    const metrics = new KnowledgeMetrics();
    metrics.recordStorageBytes(100);
    metrics.recordStorageBytes(50);
    expect(metrics.snapshot().storageBytes).toBe(150);
  });
});
