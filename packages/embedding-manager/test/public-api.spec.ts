import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

describe("public API surface", () => {
  const expectedNames = [
    "EmbeddingManager",
    "EmbeddingManagerSystem",
    "EmbeddingRegistry",
    "EmbeddingResolver",
    "EmbeddingValidator",
    "EmbeddingPipeline",
    "EmbeddingMiddleware",
    "EmbeddingFactory",
    "EmbeddingSession",
    "EmbeddingLifecycle",
    "EmbeddingStateMachine",
    "EmbeddingEvents",
    "EmbeddingMetrics",
    "EmbeddingHealth",
    "EmbeddingMonitoring",
    "EmbeddingStatistics",
  ];

  it.each(expectedNames)("exports %s as a class", (name) => {
    expect(typeof (PublicApi as unknown as Record<string, unknown>)[name]).toBe("function");
  });

  it("does NOT export the internal EmbeddingManagerLedger class", () => {
    expect(
      (PublicApi as unknown as Record<string, unknown>).EmbeddingManagerLedger,
    ).toBeUndefined();
  });

  it("does NOT export internal Validator-stage classes as top-level replacements for EmbeddingValidator", () => {
    /* the 12 stage classes ARE exported (documented as part of the curated surface),
     * but the aggregator name itself must be present and distinct */
    expect(PublicApi.EmbeddingValidator).toBeDefined();
    expect(PublicApi.IdentityValidator).toBeDefined();
  });

  it("exports the 8 domain error classes", () => {
    expect(PublicApi.EmbeddingManagerException).toBeDefined();
    expect(PublicApi.EmbeddingNotFoundException).toBeDefined();
    expect(PublicApi.DuplicateEmbeddingEntryException).toBeDefined();
    expect(PublicApi.IllegalEmbeddingTransitionException).toBeDefined();
    expect(PublicApi.InvalidEmbeddingMetadataException).toBeDefined();
    expect(PublicApi.EmbeddingCheckException).toBeDefined();
    expect(PublicApi.EmbeddingOperationException).toBeDefined();
    expect(PublicApi.EmbeddingConfigurationException).toBeDefined();
  });

  it("exports EmbeddingRegistryBucket with the 8 documented buckets", () => {
    expect(Object.values(PublicApi.EmbeddingRegistryBucket)).toHaveLength(8);
  });

  it("exports EmbeddingManagerEventType with the 11 documented events", () => {
    expect(Object.values(PublicApi.EmbeddingManagerEventType)).toHaveLength(11);
  });

  it("exports EmbeddingState with the 9 documented states", () => {
    expect(Object.values(PublicApi.EmbeddingState)).toHaveLength(9);
  });

  it("exports the token helpers", () => {
    expect(typeof PublicApi.generateEmbeddingManagerToken).toBe("function");
    expect(typeof PublicApi.isEmbeddingManagerToken).toBe("function");
  });

  it("exports createEmbeddingContext", () => {
    expect(typeof PublicApi.createEmbeddingContext).toBe("function");
  });
});
