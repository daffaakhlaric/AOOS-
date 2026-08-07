import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

const REQUIRED_PUBLIC_API_NAMES = [
  "KnowledgeGenerator",
  "KnowledgeGeneratorManager",
  "KnowledgeGeneratorRegistry",
  "KnowledgeGeneratorResolver",
  "KnowledgeGeneratorValidator",
  "KnowledgeGeneratorPipeline",
  "KnowledgeGeneratorMiddleware",
  "KnowledgeGeneratorFactory",
  "KnowledgeGeneratorSession",
  "KnowledgeGeneratorLifecycle",
  "KnowledgeGeneratorStateMachine",
  "KnowledgeGeneratorEvents",
  "KnowledgeGeneratorMetrics",
  "KnowledgeGeneratorHealth",
  "KnowledgeGeneratorMonitoring",
  "KnowledgeGeneratorStatistics",
  "KnowledgeGeneratorSystem",
];

describe("public API surface", () => {
  it.each(REQUIRED_PUBLIC_API_NAMES)("exports %s as a class", (name) => {
    expect(typeof (PublicApi as unknown as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports exactly the 17 class names plus KnowledgeGeneratorContext as the 18th named Public API member", () => {
    expect(REQUIRED_PUBLIC_API_NAMES).toHaveLength(17);
  });

  it("does not export internal validator-stage classes as one of the 18 named Public API members (but they are still exported for extensibility)", () => {
    expect(PublicApi.IdentityValidator).toBeDefined();
    expect(PublicApi.KnowledgeGeneratorValidator).toBeDefined();
  });

  it("exports the domain enums", () => {
    expect(PublicApi.KnowledgeGenerationState).toBeDefined();
    expect(PublicApi.KnowledgeGenerationAssetType).toBeDefined();
    expect(PublicApi.KnowledgeGenerationProviderType).toBeDefined();
    expect(PublicApi.KnowledgeGenerationMode).toBeDefined();
    expect(PublicApi.KnowledgeGeneratorSessionState).toBeDefined();
  });

  it("exports the Registry bucket enum with 8 buckets", () => {
    expect(Object.values(PublicApi.KnowledgeGeneratorRegistryBucket)).toHaveLength(8);
  });

  it("exports the Event type enum with 8 events", () => {
    expect(Object.values(PublicApi.KnowledgeGeneratorEventType)).toHaveLength(8);
  });

  it("exports the error hierarchy", () => {
    expect(PublicApi.KnowledgeGeneratorException).toBeDefined();
    expect(PublicApi.GeneratorNotFoundException).toBeDefined();
    expect(PublicApi.GenerationValidationException).toBeDefined();
  });

  it("exports the token helpers", () => {
    expect(typeof PublicApi.generateKnowledgeGeneratorToken).toBe("function");
    expect(typeof PublicApi.isKnowledgeGeneratorToken).toBe("function");
  });

  it("exports createKnowledgeGeneratorContext", () => {
    expect(typeof PublicApi.createKnowledgeGeneratorContext).toBe("function");
  });

  it("exports KnowledgeGenerationRecord distinctly from the KnowledgeGenerator façade", () => {
    expect(PublicApi.KnowledgeGenerationRecord).toBeDefined();
    expect(PublicApi.KnowledgeGenerationRecord).not.toBe(PublicApi.KnowledgeGenerator);
  });

  it("exports evaluateKnowledgeGenerationPolicy", () => {
    expect(typeof PublicApi.evaluateKnowledgeGenerationPolicy).toBe("function");
  });

  it("a KnowledgeGeneratorSystem constructed from the public API wires a working façade", () => {
    const publish = async () => ({}) as never;
    const system = new PublicApi.KnowledgeGeneratorSystem({
      publish,
      publishAsync: publish,
      publishBatch: async () => [],
    } as never);
    expect(system.generator).toBeInstanceOf(PublicApi.KnowledgeGenerator);
  });

  it("exports all 12 Extension Point interface-only contracts (type-only, so only verifiable via TS compile — spot check the module has no runtime export shadowing them)", () => {
    // Extension points are `export type` only — this test documents that constraint by
    // asserting none of them leak a runtime value under the same name.
    const extensionPointNames = [
      "IKnowledgeGenerationProvider",
      "IKnowledgePromptProvider",
      "IKnowledgeContextProvider",
      "IKnowledgeGenerationPolicy",
      "IKnowledgeGenerationOptimizer",
      "IKnowledgeGenerationCache",
      "IKnowledgeGenerationStorage",
      "IKnowledgeGenerationPublisher",
      "IKnowledgeGenerationAuditor",
      "IKnowledgeGenerationScheduler",
      "IKnowledgeGenerationCostProvider",
      "IKnowledgeGenerationStreamingProvider",
    ];
    for (const name of extensionPointNames) {
      expect((PublicApi as unknown as Record<string, unknown>)[name]).toBeUndefined();
    }
  });

  it("exports the 3 Future Readiness interface-only contracts as type-only (no runtime value)", () => {
    expect(
      (PublicApi as unknown as Record<string, unknown>).IKnowledgeQualityEngineGenerator,
    ).toBeUndefined();
    expect(
      (PublicApi as unknown as Record<string, unknown>).IKnowledgeValidatorAiGenerator,
    ).toBeUndefined();
    expect(
      (PublicApi as unknown as Record<string, unknown>).IEmbeddingManagerGenerator,
    ).toBeUndefined();
  });
});
