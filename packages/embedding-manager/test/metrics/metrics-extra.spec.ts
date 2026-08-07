import { describe, expect, it } from "vitest";

import { EmbeddingMetrics } from "../../src/metrics/embedding-metrics.js";

describe("EmbeddingMetrics — extra scenarios", () => {
  it("averageDurationMs is 0 with no samples", () => {
    expect(new EmbeddingMetrics().snapshot().averageDurationMs).toBe(0);
  });

  it("averageDurationMs updates correctly across 3 samples", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordDuration(10);
    metrics.recordDuration(20);
    metrics.recordDuration(30);
    expect(metrics.snapshot().averageDurationMs).toBe(20);
  });

  it("providerUsage accumulates across many distinct provider types", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordProviderUsage("openai");
    metrics.recordProviderUsage("gemini");
    metrics.recordProviderUsage("ollama");
    expect(Object.keys(metrics.snapshot().providerUsage)).toHaveLength(3);
  });

  it("recordCheck sequence produces the correct pass/fail ratio", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordCheck(true);
    metrics.recordCheck(true);
    metrics.recordCheck(false);
    const snapshot = metrics.snapshot();
    expect(snapshot.checkCount).toBe(3);
    expect(snapshot.checkFailureCount).toBe(1);
  });

  it("snapshot() returns a fresh object each call (not a live reference)", () => {
    const metrics = new EmbeddingMetrics();
    const first = metrics.snapshot();
    metrics.recordEmbedding();
    const second = metrics.snapshot();
    expect(first.embeddingCount).toBe(0);
    expect(second.embeddingCount).toBe(1);
  });

  it("all 4 registration counters are independent", () => {
    const metrics = new EmbeddingMetrics();
    metrics.recordProviderRegistered();
    metrics.recordModelRegistered();
    metrics.recordVersionCreated();
    metrics.recordNamespaceRegistered();
    const snapshot = metrics.snapshot();
    expect(snapshot.providerCount).toBe(1);
    expect(snapshot.modelCount).toBe(1);
    expect(snapshot.versionCount).toBe(1);
    expect(snapshot.namespaceCount).toBe(1);
  });
});
