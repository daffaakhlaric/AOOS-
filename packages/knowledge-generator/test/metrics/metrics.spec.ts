import { describe, expect, it } from "vitest";

import { KnowledgeGeneratorMetrics } from "../../src/metrics/knowledge-generator-metrics.js";

describe("KnowledgeGeneratorMetrics", () => {
  it("starts at all zeros", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    expect(metrics.snapshot()).toEqual({
      generationCount: 0,
      completedCount: 0,
      failedCount: 0,
      promptUsageCount: 0,
      contextUsageCount: 0,
      policyUsageCount: 0,
      providerUsageCount: 0,
      averageDurationMs: 0,
      validationCount: 0,
      validationFailureCount: 0,
    });
  });

  it("recordGeneration() increments generationCount", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    metrics.recordGeneration();
    metrics.recordGeneration();
    expect(metrics.snapshot().generationCount).toBe(2);
  });

  it("recordCompleted() increments completedCount", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    metrics.recordCompleted();
    expect(metrics.snapshot().completedCount).toBe(1);
  });

  it("recordFailed() increments failedCount", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    metrics.recordFailed();
    expect(metrics.snapshot().failedCount).toBe(1);
  });

  it("recordPromptUsage() increments promptUsageCount", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    metrics.recordPromptUsage();
    expect(metrics.snapshot().promptUsageCount).toBe(1);
  });

  it("recordContextUsage() increments contextUsageCount", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    metrics.recordContextUsage();
    expect(metrics.snapshot().contextUsageCount).toBe(1);
  });

  it("recordPolicyUsage() increments policyUsageCount", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    metrics.recordPolicyUsage();
    expect(metrics.snapshot().policyUsageCount).toBe(1);
  });

  it("recordProviderUsage() increments providerUsageCount", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    metrics.recordProviderUsage();
    expect(metrics.snapshot().providerUsageCount).toBe(1);
  });

  it("recordDuration() computes a real running average", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    metrics.recordDuration(100);
    metrics.recordDuration(300);
    expect(metrics.snapshot().averageDurationMs).toBe(200);
  });

  it("averageDurationMs stays 0 with no samples", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    expect(metrics.snapshot().averageDurationMs).toBe(0);
  });

  it("recordValidation(true) increments validationCount only", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    metrics.recordValidation(true);
    expect(metrics.snapshot()).toMatchObject({ validationCount: 1, validationFailureCount: 0 });
  });

  it("recordValidation(false) increments both counters", () => {
    const metrics = new KnowledgeGeneratorMetrics();
    metrics.recordValidation(false);
    expect(metrics.snapshot()).toMatchObject({ validationCount: 1, validationFailureCount: 1 });
  });
});
