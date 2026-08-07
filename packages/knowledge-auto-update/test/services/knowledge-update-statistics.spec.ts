import { describe, expect, it } from "vitest";

import { KnowledgeUpdateStatistics } from "../../src/services/knowledge-update-statistics.js";

describe("KnowledgeUpdateStatistics", () => {
  it("starts at all zeros", () => {
    const stats = new KnowledgeUpdateStatistics();
    const snapshot = stats.snapshot();
    expect(snapshot.updateCount).toBe(0);
    expect(snapshot.successCount).toBe(0);
    expect(snapshot.failureCount).toBe(0);
    expect(snapshot.retryCount).toBe(0);
    expect(snapshot.conflictCount).toBe(0);
    expect(snapshot.updateDurationsMs).toEqual([]);
  });

  it("records update started increments updateCount", () => {
    const stats = new KnowledgeUpdateStatistics();
    stats.recordUpdateStarted();
    stats.recordUpdateStarted();
    expect(stats.snapshot().updateCount).toBe(2);
  });

  it("records update succeeded increments successCount and records duration", () => {
    const stats = new KnowledgeUpdateStatistics();
    stats.recordUpdateSucceeded(25);
    const snapshot = stats.snapshot();
    expect(snapshot.successCount).toBe(1);
    expect(snapshot.updateDurationsMs).toEqual([25]);
  });

  it("records update failed increments failureCount", () => {
    const stats = new KnowledgeUpdateStatistics();
    stats.recordUpdateFailed();
    expect(stats.snapshot().failureCount).toBe(1);
  });

  it("records retry increments retryCount", () => {
    const stats = new KnowledgeUpdateStatistics();
    stats.recordRetry();
    stats.recordRetry();
    stats.recordRetry();
    expect(stats.snapshot().retryCount).toBe(3);
  });

  it("records conflict increments conflictCount", () => {
    const stats = new KnowledgeUpdateStatistics();
    stats.recordConflict();
    expect(stats.snapshot().conflictCount).toBe(1);
  });

  it("records validation duration", () => {
    const stats = new KnowledgeUpdateStatistics();
    stats.recordValidation(3);
    stats.recordValidation(7);
    expect(stats.snapshot().validationDurationsMs).toEqual([3, 7]);
  });

  it("records refresh duration", () => {
    const stats = new KnowledgeUpdateStatistics();
    stats.recordRefresh(11);
    expect(stats.snapshot().refreshDurationsMs).toEqual([11]);
  });

  it("accumulates a realistic mixed sequence of events correctly", () => {
    const stats = new KnowledgeUpdateStatistics();
    stats.recordUpdateStarted();
    stats.recordUpdateSucceeded(10);
    stats.recordUpdateStarted();
    stats.recordUpdateFailed();
    stats.recordRetry();
    stats.recordUpdateStarted();
    stats.recordUpdateSucceeded(20);
    const snapshot = stats.snapshot();
    expect(snapshot.updateCount).toBe(3);
    expect(snapshot.successCount).toBe(2);
    expect(snapshot.failureCount).toBe(1);
    expect(snapshot.retryCount).toBe(1);
    expect(snapshot.updateDurationsMs).toEqual([10, 20]);
  });

  it("returns a defensive copy of duration arrays", () => {
    const stats = new KnowledgeUpdateStatistics();
    stats.recordUpdateSucceeded(1);
    const snapshot = stats.snapshot();
    (snapshot.updateDurationsMs as number[]).push(999);
    expect(stats.snapshot().updateDurationsMs).toEqual([1]);
  });
});
