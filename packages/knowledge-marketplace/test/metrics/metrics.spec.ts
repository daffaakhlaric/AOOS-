import { describe, expect, it } from "vitest";

import { KnowledgeMarketplaceMetrics } from "../../src/metrics/knowledge-marketplace-metrics.js";

describe("KnowledgeMarketplaceMetrics", () => {
  it("starts at zero for every counter", () => {
    const snapshot = new KnowledgeMarketplaceMetrics().snapshot();
    expect(snapshot).toEqual({
      packageCount: 0,
      publishedCount: 0,
      certifiedCount: 0,
      categoryCount: 0,
      dependencyCount: 0,
      compatibilityCount: 0,
      publisherCount: 0,
      searchCount: 0,
      browseCount: 0,
      validationCount: 0,
      validationFailureCount: 0,
    });
  });

  it("recordPackage increments packageCount", () => {
    const metrics = new KnowledgeMarketplaceMetrics();
    metrics.recordPackage();
    metrics.recordPackage();
    expect(metrics.snapshot().packageCount).toBe(2);
  });

  it("recordPublished increments publishedCount", () => {
    const metrics = new KnowledgeMarketplaceMetrics();
    metrics.recordPublished();
    expect(metrics.snapshot().publishedCount).toBe(1);
  });

  it("recordCertified increments certifiedCount", () => {
    const metrics = new KnowledgeMarketplaceMetrics();
    metrics.recordCertified();
    expect(metrics.snapshot().certifiedCount).toBe(1);
  });

  it("recordCategory increments categoryCount", () => {
    const metrics = new KnowledgeMarketplaceMetrics();
    metrics.recordCategory();
    expect(metrics.snapshot().categoryCount).toBe(1);
  });

  it("recordDependency increments dependencyCount", () => {
    const metrics = new KnowledgeMarketplaceMetrics();
    metrics.recordDependency();
    expect(metrics.snapshot().dependencyCount).toBe(1);
  });

  it("recordCompatibility increments compatibilityCount", () => {
    const metrics = new KnowledgeMarketplaceMetrics();
    metrics.recordCompatibility();
    expect(metrics.snapshot().compatibilityCount).toBe(1);
  });

  it("recordPublisher increments publisherCount", () => {
    const metrics = new KnowledgeMarketplaceMetrics();
    metrics.recordPublisher();
    expect(metrics.snapshot().publisherCount).toBe(1);
  });

  it("recordSearch increments searchCount", () => {
    const metrics = new KnowledgeMarketplaceMetrics();
    metrics.recordSearch();
    expect(metrics.snapshot().searchCount).toBe(1);
  });

  it("recordBrowse increments browseCount", () => {
    const metrics = new KnowledgeMarketplaceMetrics();
    metrics.recordBrowse();
    expect(metrics.snapshot().browseCount).toBe(1);
  });

  it("recordValidation(true) increments validationCount only", () => {
    const metrics = new KnowledgeMarketplaceMetrics();
    metrics.recordValidation(true);
    expect(metrics.snapshot().validationCount).toBe(1);
    expect(metrics.snapshot().validationFailureCount).toBe(0);
  });

  it("recordValidation(false) increments both counters", () => {
    const metrics = new KnowledgeMarketplaceMetrics();
    metrics.recordValidation(false);
    expect(metrics.snapshot().validationCount).toBe(1);
    expect(metrics.snapshot().validationFailureCount).toBe(1);
  });
});
