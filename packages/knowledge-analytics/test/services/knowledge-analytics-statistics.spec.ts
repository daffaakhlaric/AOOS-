import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsStatistics } from "../../src/services/knowledge-analytics-statistics.js";

describe("KnowledgeAnalyticsStatistics", () => {
  it("starts every counter at 0", () => {
    const snapshot = new KnowledgeAnalyticsStatistics().snapshot(1000);
    expect(snapshot).toEqual({
      samplesRecorded: 0,
      metricsCalculated: 0,
      reportsGenerated: 0,
      dashboardSnapshotsGenerated: 0,
      pipelineRunsCompleted: 0,
      pipelineRunsFailed: 0,
      eventsPublished: 0,
      capturedAt: 1000,
    });
  });

  it("recordSampleRecorded increments by 1 by default", () => {
    const stats = new KnowledgeAnalyticsStatistics();
    stats.recordSampleRecorded();
    expect(stats.snapshot(0).samplesRecorded).toBe(1);
  });

  it("recordSampleRecorded accepts a custom count", () => {
    const stats = new KnowledgeAnalyticsStatistics();
    stats.recordSampleRecorded(5);
    expect(stats.snapshot(0).samplesRecorded).toBe(5);
  });

  it("recordMetricCalculated accumulates", () => {
    const stats = new KnowledgeAnalyticsStatistics();
    stats.recordMetricCalculated(3);
    stats.recordMetricCalculated(2);
    expect(stats.snapshot(0).metricsCalculated).toBe(5);
  });

  it("recordReportGenerated accumulates", () => {
    const stats = new KnowledgeAnalyticsStatistics();
    stats.recordReportGenerated(9);
    expect(stats.snapshot(0).reportsGenerated).toBe(9);
  });

  it("recordDashboardSnapshotGenerated accumulates", () => {
    const stats = new KnowledgeAnalyticsStatistics();
    stats.recordDashboardSnapshotGenerated();
    stats.recordDashboardSnapshotGenerated();
    expect(stats.snapshot(0).dashboardSnapshotsGenerated).toBe(2);
  });

  it("recordPipelineRunCompleted accumulates", () => {
    const stats = new KnowledgeAnalyticsStatistics();
    stats.recordPipelineRunCompleted();
    expect(stats.snapshot(0).pipelineRunsCompleted).toBe(1);
  });

  it("recordPipelineRunFailed accumulates", () => {
    const stats = new KnowledgeAnalyticsStatistics();
    stats.recordPipelineRunFailed();
    expect(stats.snapshot(0).pipelineRunsFailed).toBe(1);
  });

  it("recordEventPublished accumulates", () => {
    const stats = new KnowledgeAnalyticsStatistics();
    stats.recordEventPublished(4);
    expect(stats.snapshot(0).eventsPublished).toBe(4);
  });

  it("snapshot uses the given capturedAt", () => {
    expect(new KnowledgeAnalyticsStatistics().snapshot(42).capturedAt).toBe(42);
  });

  it("reset zeroes every counter", () => {
    const stats = new KnowledgeAnalyticsStatistics();
    stats.recordSampleRecorded(5);
    stats.recordReportGenerated(2);
    stats.reset();
    const snapshot = stats.snapshot(0);
    expect(snapshot.samplesRecorded).toBe(0);
    expect(snapshot.reportsGenerated).toBe(0);
  });
});
