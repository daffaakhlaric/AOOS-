import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexMetrics } from "../../src/metrics/knowledge-index-metrics.js";

describe("Metrics Test — KnowledgeIndexMetrics", () => {
  it("starts every counter at zero", () => {
    const metrics = new KnowledgeIndexMetrics();
    const snapshot = metrics.snapshot();
    expect(snapshot.indexCount).toBe(0);
    expect(snapshot.buildCount).toBe(0);
    expect(snapshot.buildFailures).toBe(0);
    expect(snapshot.rebuildCount).toBe(0);
    expect(snapshot.optimizeCount).toBe(0);
    expect(snapshot.averageBuildTimeMs).toBe(0);
    expect(snapshot.tenantUsage).toEqual({});
    expect(snapshot.workspaceUsage).toEqual({});
  });

  it("recordEntryBuilt()/recordEntryRemoved() maintain entriesByType and indexCount", () => {
    const metrics = new KnowledgeIndexMetrics();
    metrics.recordEntryBuilt(KnowledgeIndexType.KEYWORD);
    metrics.recordEntryBuilt(KnowledgeIndexType.KEYWORD);
    metrics.recordEntryBuilt(KnowledgeIndexType.TAG);
    metrics.recordEntryRemoved(KnowledgeIndexType.KEYWORD);
    const snapshot = metrics.snapshot();
    expect(snapshot.entriesByType[KnowledgeIndexType.KEYWORD]).toBe(1);
    expect(snapshot.entriesByType[KnowledgeIndexType.TAG]).toBe(1);
    expect(snapshot.indexCount).toBe(2);
  });

  it("recordEntryRemoved() never goes below zero", () => {
    const metrics = new KnowledgeIndexMetrics();
    metrics.recordEntryRemoved(KnowledgeIndexType.KEYWORD);
    expect(metrics.snapshot().entriesByType[KnowledgeIndexType.KEYWORD]).toBe(0);
  });

  it("recordBuildCompleted() tracks buildCount and averageBuildTimeMs", () => {
    const metrics = new KnowledgeIndexMetrics();
    metrics.recordBuildCompleted(10);
    metrics.recordBuildCompleted(30);
    const snapshot = metrics.snapshot();
    expect(snapshot.buildCount).toBe(2);
    expect(snapshot.averageBuildTimeMs).toBe(20);
  });

  it("recordBuildFailed()/recordRebuild()/recordOptimize() track their counters", () => {
    const metrics = new KnowledgeIndexMetrics();
    metrics.recordBuildFailed();
    metrics.recordRebuild();
    metrics.recordOptimize();
    const snapshot = metrics.snapshot();
    expect(snapshot.buildFailures).toBe(1);
    expect(snapshot.rebuildCount).toBe(1);
    expect(snapshot.optimizeCount).toBe(1);
  });

  it("recordTenantUsage()/recordWorkspaceUsage() track per-id call counts", () => {
    const metrics = new KnowledgeIndexMetrics();
    metrics.recordTenantUsage("tenant-1");
    metrics.recordTenantUsage("tenant-1");
    metrics.recordWorkspaceUsage("ws-1");
    const snapshot = metrics.snapshot();
    expect(snapshot.tenantUsage).toEqual({ "tenant-1": 2 });
    expect(snapshot.workspaceUsage).toEqual({ "ws-1": 1 });
  });
});
