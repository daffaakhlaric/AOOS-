import { describe, expect, it } from "vitest";

import { KnowledgeQualityAnalytics } from "../../src/analytics/knowledge-quality-analytics.js";

describe("KnowledgeQualityAnalytics", () => {
  it("counts every recorded quality check", () => {
    const quality = new KnowledgeQualityAnalytics();
    quality.recordQualityCheck({ succeeded: true });
    quality.recordQualityCheck({ succeeded: false });
    expect(quality.checkCount()).toBe(2);
  });

  it("returns 0 for every metric with no recordings", () => {
    const quality = new KnowledgeQualityAnalytics();
    expect(quality.checkCount()).toBe(0);
    expect(quality.successRate()).toBe(0);
    expect(quality.failureRate()).toBe(0);
    expect(quality.qualityScore()).toBe(0);
  });

  it("computes the exact success and failure rate for a 3:1 split", () => {
    const quality = new KnowledgeQualityAnalytics();
    quality.recordQualityCheck({ succeeded: true });
    quality.recordQualityCheck({ succeeded: true });
    quality.recordQualityCheck({ succeeded: true });
    quality.recordQualityCheck({ succeeded: false });
    expect(quality.successRate()).toBe(0.75);
    expect(quality.failureRate()).toBe(0.25);
  });

  it("qualityScore equals successRate", () => {
    const quality = new KnowledgeQualityAnalytics();
    quality.recordQualityCheck({ succeeded: true });
    quality.recordQualityCheck({ succeeded: false });
    expect(quality.qualityScore()).toBe(quality.successRate());
  });

  it("successRate + failureRate sum to 1", () => {
    const quality = new KnowledgeQualityAnalytics();
    quality.recordQualityCheck({ succeeded: true });
    quality.recordQualityCheck({ succeeded: false });
    quality.recordQualityCheck({ succeeded: false });
    expect(quality.successRate() + quality.failureRate()).toBeCloseTo(1, 10);
  });

  it("summary reports every owned metric", () => {
    const quality = new KnowledgeQualityAnalytics();
    quality.recordQualityCheck({ succeeded: true });
    expect(quality.summary()).toEqual({
      checkCount: 1,
      successRate: 1,
      failureRate: 0,
      qualityScore: 1,
    });
  });
});
