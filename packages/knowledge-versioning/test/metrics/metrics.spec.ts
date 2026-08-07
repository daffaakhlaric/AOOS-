import { describe, expect, it } from "vitest";

import { KnowledgeVersionMetrics } from "../../src/metrics/knowledge-version-metrics.js";

describe("KnowledgeVersionMetrics", () => {
  it("starts all counters at zero", () => {
    const metrics = new KnowledgeVersionMetrics();
    expect(metrics.snapshot()).toEqual({
      versionCount: 0,
      snapshotCount: 0,
      branchCount: 0,
      rollbackCount: 0,
      mergeCount: 0,
      comparisonCount: 0,
      archiveCount: 0,
      publishCount: 0,
      validationCount: 0,
      validationFailureCount: 0,
    });
  });

  it("increments each of the 9 named counters", () => {
    const metrics = new KnowledgeVersionMetrics();
    metrics.recordVersion();
    metrics.recordSnapshot();
    metrics.recordBranch();
    metrics.recordRollback();
    metrics.recordMerge();
    metrics.recordComparison();
    metrics.recordArchive();
    metrics.recordPublish();
    metrics.recordValidation(true);
    const snapshot = metrics.snapshot();
    expect(snapshot.versionCount).toBe(1);
    expect(snapshot.snapshotCount).toBe(1);
    expect(snapshot.branchCount).toBe(1);
    expect(snapshot.rollbackCount).toBe(1);
    expect(snapshot.mergeCount).toBe(1);
    expect(snapshot.comparisonCount).toBe(1);
    expect(snapshot.archiveCount).toBe(1);
    expect(snapshot.publishCount).toBe(1);
    expect(snapshot.validationCount).toBe(1);
    expect(snapshot.validationFailureCount).toBe(0);
  });

  it("tracks validation failures separately from successes", () => {
    const metrics = new KnowledgeVersionMetrics();
    metrics.recordValidation(true);
    metrics.recordValidation(false);
    const snapshot = metrics.snapshot();
    expect(snapshot.validationCount).toBe(2);
    expect(snapshot.validationFailureCount).toBe(1);
  });
});
