import { describe, expect, it } from "vitest";

import { EmbeddingMetrics } from "../../src/metrics/embedding-metrics.js";

describe("EmbeddingMetrics", () => {
  it("starts at zero for all 8 named counters", () => {
    const metrics = new EmbeddingMetrics();
    const snapshot = metrics.snapshot();
    expect(snapshot.embeddingCount).toBe(0);
    expect(snapshot.providerCount).toBe(0);
    expect(snapshot.modelCount).toBe(0);
    expect(snapshot.versionCount).toBe(0);
    expect(snapshot.namespaceCount).toBe(0);
    expect(snapshot.averageDurationMs).toBe(0);
    expect(snapshot.cacheMetadataCount).toBe(0);
    expect(snapshot.providerUsage).toEqual({});
  });

  it("recordEmbedding() increments embeddingCount", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordEmbedding();
    metrics.recordEmbedding();
    expect(metrics.snapshot().embeddingCount).toBe(2);
  });

  it("recordProviderRegistered() increments providerCount", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordProviderRegistered();
    expect(metrics.snapshot().providerCount).toBe(1);
  });

  it("recordModelRegistered() increments modelCount", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordModelRegistered();
    expect(metrics.snapshot().modelCount).toBe(1);
  });

  it("recordVersionCreated() increments versionCount", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordVersionCreated();
    expect(metrics.snapshot().versionCount).toBe(1);
  });

  it("recordNamespaceRegistered() increments namespaceCount", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordNamespaceRegistered();
    expect(metrics.snapshot().namespaceCount).toBe(1);
  });

  it("recordCacheMetadata() increments cacheMetadataCount", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordCacheMetadata();
    expect(metrics.snapshot().cacheMetadataCount).toBe(1);
  });

  it("recordDuration() computes a real running average", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordDuration(100);
    metrics.recordDuration(200);
    expect(metrics.snapshot().averageDurationMs).toBe(150);
  });

  it("recordProviderUsage() tallies per providerType", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordProviderUsage("openai");
    metrics.recordProviderUsage("openai");
    metrics.recordProviderUsage("cohere");
    expect(metrics.snapshot().providerUsage).toEqual({ openai: 2, cohere: 1 });
  });

  it("recordCheck(true) increments checkCount only", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordCheck(true);
    const snapshot = metrics.snapshot();
    expect(snapshot.checkCount).toBe(1);
    expect(snapshot.checkFailureCount).toBe(0);
  });

  it("recordCheck(false) increments both checkCount and checkFailureCount", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordCheck(false);
    const snapshot = metrics.snapshot();
    expect(snapshot.checkCount).toBe(1);
    expect(snapshot.checkFailureCount).toBe(1);
  });
});
