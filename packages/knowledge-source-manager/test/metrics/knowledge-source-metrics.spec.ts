import { describe, expect, it } from "vitest";

import { KnowledgeSourceMetrics } from "../../src/metrics/knowledge-source-metrics.js";

describe("KnowledgeSourceMetrics", () => {
  it("starts every counter at 0", () => {
    const metrics = new KnowledgeSourceMetrics();
    expect(metrics.snapshot()).toEqual({
      sourceCount: 0,
      providerCount: 0,
      workspaceCount: 0,
      tenantCount: 0,
      namespaceCount: 0,
      collectionCount: 0,
      syncEnabledCount: 0,
      scheduleCount: 0,
      policyCount: 0,
      permissionCount: 0,
    });
  });

  it("has exactly the 10 fields named in the prompt", () => {
    const metrics = new KnowledgeSourceMetrics();
    expect(Object.keys(metrics.snapshot())).toHaveLength(10);
  });

  it("setters are reflected in the snapshot", () => {
    const metrics = new KnowledgeSourceMetrics();
    metrics.setSourceCount(1);
    metrics.setProviderCount(2);
    metrics.setWorkspaceCount(3);
    metrics.setTenantCount(4);
    metrics.setNamespaceCount(5);
    metrics.setCollectionCount(6);
    metrics.setSyncEnabledCount(7);
    metrics.setScheduleCount(8);
    metrics.setPolicyCount(9);
    metrics.setPermissionCount(10);
    expect(metrics.snapshot()).toEqual({
      sourceCount: 1,
      providerCount: 2,
      workspaceCount: 3,
      tenantCount: 4,
      namespaceCount: 5,
      collectionCount: 6,
      syncEnabledCount: 7,
      scheduleCount: 8,
      policyCount: 9,
      permissionCount: 10,
    });
  });
});
