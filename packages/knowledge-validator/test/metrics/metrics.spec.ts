import { describe, expect, it } from "vitest";

import { KnowledgeValidatorMetrics } from "../../src/metrics/knowledge-validator-metrics.js";

describe("KnowledgeValidatorMetrics", () => {
  it("starts every counter at zero", () => {
    const metrics = new KnowledgeValidatorMetrics();
    expect(metrics.snapshot()).toEqual({
      validationCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      decisionCount: 0,
      ruleUsageCount: 0,
      policyUsageCount: 0,
      averageDurationMs: 0,
      averageConfidenceMetadata: 0,
      configurationUsageCount: 0,
      findingCount: 0,
      checkCount: 0,
      checkFailureCount: 0,
    });
  });

  it("recordValidation increments validationCount", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordValidation();
    metrics.recordValidation();
    expect(metrics.snapshot().validationCount).toBe(2);
  });

  it("recordApproved increments approvedCount", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordApproved();
    expect(metrics.snapshot().approvedCount).toBe(1);
  });

  it("recordRejected increments rejectedCount", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordRejected();
    expect(metrics.snapshot().rejectedCount).toBe(1);
  });

  it("recordDecision increments decisionCount", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordDecision();
    expect(metrics.snapshot().decisionCount).toBe(1);
  });

  it("recordDecision without confidence does not affect averageConfidenceMetadata", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordDecision();
    expect(metrics.snapshot().averageConfidenceMetadata).toBe(0);
  });

  it("recordDecision computes a real running average of confidence", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordDecision(0.8);
    metrics.recordDecision(0.4);
    expect(metrics.snapshot().averageConfidenceMetadata).toBeCloseTo(0.6);
  });

  it("recordRuleUsage accumulates counts", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordRuleUsage(2);
    metrics.recordRuleUsage(3);
    expect(metrics.snapshot().ruleUsageCount).toBe(5);
  });

  it("recordPolicyUsage increments policyUsageCount", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordPolicyUsage();
    expect(metrics.snapshot().policyUsageCount).toBe(1);
  });

  it("recordConfigurationUsage increments configurationUsageCount", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordConfigurationUsage();
    expect(metrics.snapshot().configurationUsageCount).toBe(1);
  });

  it("recordFinding increments findingCount", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordFinding();
    expect(metrics.snapshot().findingCount).toBe(1);
  });

  it("recordDuration computes a real running average", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordDuration(100);
    metrics.recordDuration(300);
    expect(metrics.snapshot().averageDurationMs).toBe(200);
  });

  it("recordCheck increments checkCount always", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordCheck(true);
    metrics.recordCheck(false);
    expect(metrics.snapshot().checkCount).toBe(2);
  });

  it("recordCheck increments checkFailureCount only on failure", () => {
    const metrics = new KnowledgeValidatorMetrics();
    metrics.recordCheck(true);
    metrics.recordCheck(false);
    expect(metrics.snapshot().checkFailureCount).toBe(1);
  });
});
