import { describe, expect, it } from "vitest";

import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";
import { KnowledgeRetrievalMetrics } from "../../src/metrics/knowledge-retrieval-metrics.js";

describe("KnowledgeRetrievalMetrics", () => {
  it("starts with a zeroed snapshot", () => {
    const metrics = new KnowledgeRetrievalMetrics();
    const snapshot = metrics.snapshot();
    expect(snapshot.totalQueries).toBe(0);
    expect(snapshot.averageLatencyMs).toBe(0);
    expect(snapshot.averageRankingTimeMs).toBe(0);
    expect(snapshot.averageFilterTimeMs).toBe(0);
  });

  it("tracks totalQueries/successfulQueries/failedQueries", () => {
    const metrics = new KnowledgeRetrievalMetrics();
    metrics.recordQueryStarted();
    metrics.recordQueryStarted();
    metrics.recordQueryCompleted(10);
    metrics.recordQueryFailed();
    const snapshot = metrics.snapshot();
    expect(snapshot.totalQueries).toBe(2);
    expect(snapshot.successfulQueries).toBe(1);
    expect(snapshot.failedQueries).toBe(1);
    expect(snapshot.averageLatencyMs).toBe(10);
  });

  it("averages ranking and filter time across samples", () => {
    const metrics = new KnowledgeRetrievalMetrics();
    metrics.recordRankingTime(10);
    metrics.recordRankingTime(20);
    metrics.recordFilterTime(4);
    metrics.recordFilterTime(6);
    const snapshot = metrics.snapshot();
    expect(snapshot.averageRankingTimeMs).toBe(15);
    expect(snapshot.averageFilterTimeMs).toBe(5);
  });

  it("accumulates permission/policy reject counts", () => {
    const metrics = new KnowledgeRetrievalMetrics();
    metrics.recordPermissionReject(2);
    metrics.recordPermissionReject(3);
    metrics.recordPolicyReject(1);
    const snapshot = metrics.snapshot();
    expect(snapshot.permissionRejectCount).toBe(5);
    expect(snapshot.policyRejectCount).toBe(1);
  });

  it("tracks workspace and tenant usage counts", () => {
    const metrics = new KnowledgeRetrievalMetrics();
    metrics.recordWorkspaceUsage("workspace-1");
    metrics.recordWorkspaceUsage("workspace-1");
    metrics.recordTenantUsage("tenant-1");
    const snapshot = metrics.snapshot();
    expect(snapshot.workspaceUsage).toEqual({ "workspace-1": 2 });
    expect(snapshot.tenantUsage).toEqual({ "tenant-1": 1 });
  });

  it("tracks search mode statistics for every KnowledgeSearchMode", () => {
    const metrics = new KnowledgeRetrievalMetrics();
    metrics.recordSearchMode(KnowledgeSearchMode.KEYWORD);
    const snapshot = metrics.snapshot();
    expect(snapshot.searchModeStatistics[KnowledgeSearchMode.KEYWORD]).toBe(1);
    expect(snapshot.searchModeStatistics[KnowledgeSearchMode.HYBRID]).toBe(0);
    expect(Object.keys(snapshot.searchModeStatistics)).toHaveLength(19);
  });
});
