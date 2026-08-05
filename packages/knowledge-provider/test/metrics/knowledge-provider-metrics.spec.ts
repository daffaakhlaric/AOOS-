import { describe, expect, it } from "vitest";

import { KnowledgeProviderCapabilityFlag } from "../../src/domain/knowledge-provider-capability-flag.js";
import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";
import { KnowledgeProviderMetrics } from "../../src/metrics/knowledge-provider-metrics.js";

describe("KnowledgeProviderMetrics", () => {
  it("starts with a zeroed snapshot", () => {
    const metrics = new KnowledgeProviderMetrics();
    const snapshot = metrics.snapshot();
    expect(snapshot.providerCount).toBe(0);
    expect(snapshot.failureCount).toBe(0);
    expect(snapshot.registrationCount).toBe(0);
  });

  it("tracks registrationCount via recordProviderRegistered()", () => {
    const metrics = new KnowledgeProviderMetrics();
    metrics.recordProviderRegistered("provider-1");
    metrics.recordProviderRegistered("provider-2");
    expect(metrics.snapshot().registrationCount).toBe(2);
  });

  it("tracks providerUsage per providerId", () => {
    const metrics = new KnowledgeProviderMetrics();
    metrics.recordProviderUsage("provider-1");
    metrics.recordProviderUsage("provider-1");
    expect(metrics.snapshot().providerUsage).toEqual({ "provider-1": 2 });
  });

  it("tracks providerCategory statistics for every KnowledgeProviderCategory", () => {
    const metrics = new KnowledgeProviderMetrics();
    metrics.recordProviderCategory(KnowledgeProviderCategory.DOCUMENT);
    const snapshot = metrics.snapshot();
    expect(snapshot.providerCategory[KnowledgeProviderCategory.DOCUMENT]).toBe(1);
    expect(snapshot.providerCategory[KnowledgeProviderCategory.DATABASE]).toBe(0);
    expect(Object.keys(snapshot.providerCategory)).toHaveLength(13);
  });

  it("tracks capabilityUsage statistics for every KnowledgeProviderCapabilityFlag", () => {
    const metrics = new KnowledgeProviderMetrics();
    metrics.recordCapabilityUsage(KnowledgeProviderCapabilityFlag.SUPPORTS_READ);
    const snapshot = metrics.snapshot();
    expect(snapshot.capabilityUsage[KnowledgeProviderCapabilityFlag.SUPPORTS_READ]).toBe(1);
    expect(Object.keys(snapshot.capabilityUsage)).toHaveLength(20);
  });

  it("tracks workspace/tenant usage counts", () => {
    const metrics = new KnowledgeProviderMetrics();
    metrics.recordWorkspaceUsage("workspace-1");
    metrics.recordTenantUsage("tenant-1");
    const snapshot = metrics.snapshot();
    expect(snapshot.workspaceUsage).toEqual({ "workspace-1": 1 });
    expect(snapshot.tenantUsage).toEqual({ "tenant-1": 1 });
  });

  it("tracks failureCount and healthCount", () => {
    const metrics = new KnowledgeProviderMetrics();
    metrics.recordFailure();
    metrics.recordHealthCheck();
    metrics.recordHealthCheck();
    const snapshot = metrics.snapshot();
    expect(snapshot.failureCount).toBe(1);
    expect(snapshot.healthCount).toBe(2);
  });

  it("setProviderCount() sets the provider count gauge", () => {
    const metrics = new KnowledgeProviderMetrics();
    metrics.setProviderCount(7);
    expect(metrics.snapshot().providerCount).toBe(7);
  });
});
