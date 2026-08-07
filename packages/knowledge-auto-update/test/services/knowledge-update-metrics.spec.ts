import { describe, expect, it } from "vitest";

import { KnowledgeUpdateMetrics } from "../../src/services/knowledge-update-metrics.js";

function baseInput() {
  return {
    updateCount: 10,
    successCount: 7,
    failureCount: 3,
    retryCount: 2,
    conflictCount: 1,
    updateDurationsMs: [10, 20, 30],
    validationDurationsMs: [1, 2, 3],
    refreshDurationsMs: [5, 15],
    pendingJobs: 4,
    completedJobs: 7,
    cancelledJobs: 1,
    expiredJobs: 0,
    queueSize: 5,
  };
}

describe("KnowledgeUpdateMetrics", () => {
  const metrics = new KnowledgeUpdateMetrics();

  it("passes through raw counters unchanged", () => {
    const snapshot = metrics.compute(baseInput());
    expect(snapshot.updateCount).toBe(10);
    expect(snapshot.successCount).toBe(7);
    expect(snapshot.failureCount).toBe(3);
    expect(snapshot.retryCount).toBe(2);
    expect(snapshot.conflictCount).toBe(1);
    expect(snapshot.pendingJobs).toBe(4);
    expect(snapshot.completedJobs).toBe(7);
    expect(snapshot.cancelledJobs).toBe(1);
    expect(snapshot.expiredJobs).toBe(0);
    expect(snapshot.queueSize).toBe(5);
  });

  it("computes average update/validation/refresh time correctly", () => {
    const snapshot = metrics.compute(baseInput());
    expect(snapshot.averageUpdateTimeMs).toBe(20);
    expect(snapshot.averageValidationTimeMs).toBe(2);
    expect(snapshot.averageRefreshTimeMs).toBe(10);
  });

  it("returns 0 average for empty duration arrays", () => {
    const snapshot = metrics.compute({
      ...baseInput(),
      updateDurationsMs: [],
      validationDurationsMs: [],
      refreshDurationsMs: [],
    });
    expect(snapshot.averageUpdateTimeMs).toBe(0);
    expect(snapshot.averageValidationTimeMs).toBe(0);
    expect(snapshot.averageRefreshTimeMs).toBe(0);
  });

  it("computes success/failure/retry rate correctly", () => {
    const snapshot = metrics.compute(baseInput());
    expect(snapshot.successRate).toBeCloseTo(0.7);
    expect(snapshot.failureRate).toBeCloseTo(0.3);
    expect(snapshot.retryRate).toBeCloseTo(0.2);
  });

  describe("parameterized rate table", () => {
    const cases: Array<[number, number, number]> = [
      [100, 25, 0.25],
      [4, 1, 0.25],
      [3, 1, 1 / 3],
      [1, 1, 1],
      [1, 0, 0],
    ];
    it.each(cases)(
      "successCount %i of updateCount %i -> rate %f",
      (updateCount, successCount, rate) => {
        const snapshot = metrics.compute({ ...baseInput(), updateCount, successCount });
        expect(snapshot.successRate).toBeCloseTo(rate);
      },
    );
  });

  it("computes averages correctly for a single-element duration array", () => {
    const snapshot = metrics.compute({ ...baseInput(), updateDurationsMs: [42] });
    expect(snapshot.averageUpdateTimeMs).toBe(42);
  });

  it("returns 0 rates when updateCount is 0 (no division by zero)", () => {
    const snapshot = metrics.compute({
      ...baseInput(),
      updateCount: 0,
      successCount: 0,
      failureCount: 0,
      retryCount: 0,
    });
    expect(snapshot.successRate).toBe(0);
    expect(snapshot.failureRate).toBe(0);
    expect(snapshot.retryRate).toBe(0);
  });
});
