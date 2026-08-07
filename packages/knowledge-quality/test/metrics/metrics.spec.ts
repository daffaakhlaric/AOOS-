import { describe, expect, it } from "vitest";

import { KnowledgeQualityMetrics } from "../../src/metrics/knowledge-quality-metrics.js";

describe("KnowledgeQualityMetrics", () => {
  it("starts at all zeros", () => {
    const metrics = new KnowledgeQualityMetrics();
    expect(metrics.snapshot()).toEqual({
      assessmentCount: 0,
      findingCount: 0,
      ruleUsageCount: 0,
      profileUsageCount: 0,
      averageDurationMs: 0,
      averageScoreMetadata: 0,
      policyUsageCount: 0,
      configurationUsageCount: 0,
      completedCount: 0,
      failedCount: 0,
      validationCount: 0,
      validationFailureCount: 0,
    });
  });

  it("recordAssessment() increments assessmentCount", () => {
    const metrics = new KnowledgeQualityMetrics();
    metrics.recordAssessment();
    metrics.recordAssessment();
    expect(metrics.snapshot().assessmentCount).toBe(2);
  });

  it("recordFinding() increments findingCount", () => {
    const metrics = new KnowledgeQualityMetrics();
    metrics.recordFinding();
    metrics.recordFinding();
    metrics.recordFinding();
    expect(metrics.snapshot().findingCount).toBe(3);
  });

  it("recordCompleted() increments completedCount", () => {
    const metrics = new KnowledgeQualityMetrics();
    metrics.recordCompleted();
    expect(metrics.snapshot().completedCount).toBe(1);
  });

  it("recordFailed() increments failedCount", () => {
    const metrics = new KnowledgeQualityMetrics();
    metrics.recordFailed();
    expect(metrics.snapshot().failedCount).toBe(1);
  });

  it("recordRuleUsage() adds the given count to ruleUsageCount", () => {
    const metrics = new KnowledgeQualityMetrics();
    metrics.recordRuleUsage(3);
    metrics.recordRuleUsage(2);
    expect(metrics.snapshot().ruleUsageCount).toBe(5);
  });

  it("recordProfileUsage() increments profileUsageCount", () => {
    const metrics = new KnowledgeQualityMetrics();
    metrics.recordProfileUsage();
    expect(metrics.snapshot().profileUsageCount).toBe(1);
  });

  it("recordPolicyUsage() increments policyUsageCount", () => {
    const metrics = new KnowledgeQualityMetrics();
    metrics.recordPolicyUsage();
    expect(metrics.snapshot().policyUsageCount).toBe(1);
  });

  it("recordConfigurationUsage() increments configurationUsageCount", () => {
    const metrics = new KnowledgeQualityMetrics();
    metrics.recordConfigurationUsage();
    expect(metrics.snapshot().configurationUsageCount).toBe(1);
  });

  it("recordDuration() computes a real running average", () => {
    const metrics = new KnowledgeQualityMetrics();
    metrics.recordDuration(100);
    metrics.recordDuration(300);
    expect(metrics.snapshot().averageDurationMs).toBe(200);
  });

  it("averageDurationMs stays 0 with no samples", () => {
    const metrics = new KnowledgeQualityMetrics();
    expect(metrics.snapshot().averageDurationMs).toBe(0);
  });

  it("recordScore() computes a real running average", () => {
    const metrics = new KnowledgeQualityMetrics();
    metrics.recordScore(0.5);
    metrics.recordScore(0.9);
    expect(metrics.snapshot().averageScoreMetadata).toBeCloseTo(0.7);
  });

  it("averageScoreMetadata stays 0 with no samples", () => {
    const metrics = new KnowledgeQualityMetrics();
    expect(metrics.snapshot().averageScoreMetadata).toBe(0);
  });

  it("recordValidation(true) increments validationCount only", () => {
    const metrics = new KnowledgeQualityMetrics();
    metrics.recordValidation(true);
    expect(metrics.snapshot()).toMatchObject({ validationCount: 1, validationFailureCount: 0 });
  });

  it("recordValidation(false) increments both counters", () => {
    const metrics = new KnowledgeQualityMetrics();
    metrics.recordValidation(false);
    expect(metrics.snapshot()).toMatchObject({ validationCount: 1, validationFailureCount: 1 });
  });
});
