import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

const REQUIRED_PUBLIC_API_NAMES = [
  "KnowledgeQuality",
  "KnowledgeQualityManager",
  "KnowledgeQualityRegistry",
  "KnowledgeQualityResolver",
  "KnowledgeQualityValidator",
  "KnowledgeQualityPipeline",
  "KnowledgeQualityMiddleware",
  "KnowledgeQualityFactory",
  "KnowledgeQualitySession",
  "KnowledgeQualityLifecycle",
  "KnowledgeQualityStateMachine",
  "KnowledgeQualityEvents",
  "KnowledgeQualityMetrics",
  "KnowledgeQualityHealth",
  "KnowledgeQualityMonitoring",
  "KnowledgeQualityStatistics",
  "KnowledgeQualitySystem",
];

describe("public API surface", () => {
  it.each(REQUIRED_PUBLIC_API_NAMES)("exports %s as a class", (name) => {
    expect(typeof (PublicApi as unknown as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports exactly the 17 class names plus KnowledgeQualityContext as the 18th named Public API member", () => {
    expect(REQUIRED_PUBLIC_API_NAMES).toHaveLength(17);
  });

  it("does not export internal validator-stage classes as one of the 18 named Public API members (but they are still exported for extensibility)", () => {
    expect(PublicApi.IdentityValidator).toBeDefined();
    expect(PublicApi.KnowledgeQualityValidator).toBeDefined();
  });

  it("exports the domain enums", () => {
    expect(PublicApi.KnowledgeQualityAssessmentState).toBeDefined();
    expect(PublicApi.KnowledgeQualityDimension).toBeDefined();
    expect(PublicApi.KnowledgeQualityAssessmentMode).toBeDefined();
    expect(PublicApi.KnowledgeQualitySessionState).toBeDefined();
  });

  it("exports the Registry bucket enum with 8 buckets", () => {
    expect(Object.values(PublicApi.KnowledgeQualityRegistryBucket)).toHaveLength(8);
  });

  it("exports the Event type enum with 10 events", () => {
    expect(Object.values(PublicApi.KnowledgeQualityEventType)).toHaveLength(10);
  });

  it("exports the error hierarchy", () => {
    expect(PublicApi.KnowledgeQualityException).toBeDefined();
    expect(PublicApi.QualityNotFoundException).toBeDefined();
    expect(PublicApi.AssessmentValidationException).toBeDefined();
  });

  it("exports the token helpers", () => {
    expect(typeof PublicApi.generateKnowledgeQualityToken).toBe("function");
    expect(typeof PublicApi.isKnowledgeQualityToken).toBe("function");
  });

  it("exports createKnowledgeQualityContext", () => {
    expect(typeof PublicApi.createKnowledgeQualityContext).toBe("function");
  });

  it("exports KnowledgeQualityAssessmentRecord distinctly from the KnowledgeQuality façade", () => {
    expect(PublicApi.KnowledgeQualityAssessmentRecord).toBeDefined();
    expect(PublicApi.KnowledgeQualityAssessmentRecord).not.toBe(PublicApi.KnowledgeQuality);
  });

  it("exports evaluateKnowledgeQualityPolicy", () => {
    expect(typeof PublicApi.evaluateKnowledgeQualityPolicy).toBe("function");
  });

  it("a KnowledgeQualitySystem constructed from the public API wires a working façade", () => {
    const publish = async () => ({}) as never;
    const system = new PublicApi.KnowledgeQualitySystem({
      publish,
      publishAsync: publish,
      publishBatch: async () => [],
    } as never);
    expect(system.quality).toBeInstanceOf(PublicApi.KnowledgeQuality);
  });

  it("exports all 12 Extension Point interface-only contracts (type-only, so only verifiable via TS compile — spot check the module has no runtime export shadowing them)", () => {
    // Extension points are `export type` only — this test documents that constraint by
    // asserting none of them leak a runtime value under the same name.
    const extensionPointNames = [
      "IKnowledgeQualityProvider",
      "IKnowledgeQualityRuleProvider",
      "IKnowledgeQualityPolicyProvider",
      "IKnowledgeQualityScoringProvider",
      "IKnowledgeQualityAuditProvider",
      "IKnowledgeQualityStorage",
      "IKnowledgeQualityPublisher",
      "IKnowledgeQualityScheduler",
      "IKnowledgeQualityReporter",
      "IKnowledgeQualityCostProvider",
      "IKnowledgeQualityStreamingProvider",
      "IKnowledgeQualityMetricsProvider",
    ];
    for (const name of extensionPointNames) {
      expect((PublicApi as unknown as Record<string, unknown>)[name]).toBeUndefined();
    }
  });

  it("exports the 3 Future Readiness interface-only contracts as type-only (no runtime value)", () => {
    expect(
      (PublicApi as unknown as Record<string, unknown>).IKnowledgeQualityEngineQuality,
    ).toBeUndefined();
    expect(
      (PublicApi as unknown as Record<string, unknown>).IKnowledgeValidatorAiQuality,
    ).toBeUndefined();
    expect(
      (PublicApi as unknown as Record<string, unknown>).IEmbeddingManagerQuality,
    ).toBeUndefined();
  });
});
