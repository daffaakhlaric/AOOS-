import { describe, expect, it } from "vitest";

import { KnowledgePolicyMetrics } from "../../src/metrics/knowledge-policy-metrics.js";

describe("KnowledgePolicyMetrics", () => {
  it("starts with all counters at 0", () => {
    const metrics = new KnowledgePolicyMetrics();
    expect(metrics.snapshot()).toEqual({
      policyCount: 0,
      activePolicyCount: 0,
      assignmentCount: 0,
      evaluationCount: 0,
      validationCount: 0,
      archiveCount: 0,
      restoreCount: 0,
      validationFailureCount: 0,
    });
  });

  it("recordPolicy() increments policyCount", () => {
    const metrics = new KnowledgePolicyMetrics();
    metrics.recordPolicy();
    metrics.recordPolicy();
    expect(metrics.snapshot().policyCount).toBe(2);
  });

  it("recordActivePolicy() increments activePolicyCount", () => {
    const metrics = new KnowledgePolicyMetrics();
    metrics.recordActivePolicy();
    expect(metrics.snapshot().activePolicyCount).toBe(1);
  });

  it("recordAssignment() increments assignmentCount", () => {
    const metrics = new KnowledgePolicyMetrics();
    metrics.recordAssignment();
    expect(metrics.snapshot().assignmentCount).toBe(1);
  });

  it("recordEvaluation() increments evaluationCount", () => {
    const metrics = new KnowledgePolicyMetrics();
    metrics.recordEvaluation();
    expect(metrics.snapshot().evaluationCount).toBe(1);
  });

  it("recordValidation(true) increments validationCount but not failures", () => {
    const metrics = new KnowledgePolicyMetrics();
    metrics.recordValidation(true);
    expect(metrics.snapshot().validationCount).toBe(1);
    expect(metrics.snapshot().validationFailureCount).toBe(0);
  });

  it("recordValidation(false) increments both validationCount and failures", () => {
    const metrics = new KnowledgePolicyMetrics();
    metrics.recordValidation(false);
    expect(metrics.snapshot().validationCount).toBe(1);
    expect(metrics.snapshot().validationFailureCount).toBe(1);
  });

  it("recordArchive() increments archiveCount", () => {
    const metrics = new KnowledgePolicyMetrics();
    metrics.recordArchive();
    expect(metrics.snapshot().archiveCount).toBe(1);
  });

  it("recordRestore() increments restoreCount", () => {
    const metrics = new KnowledgePolicyMetrics();
    metrics.recordRestore();
    expect(metrics.snapshot().restoreCount).toBe(1);
  });
});
