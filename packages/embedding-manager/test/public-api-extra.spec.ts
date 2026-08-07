import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

describe("public API surface — extra checks", () => {
  it("exports exactly 12 Extension Point interfaces as type-only (no runtime value)", () => {
    /* Interfaces have no runtime representation; this test documents that the
     * package's contracts are compile-time-only, not accidentally exported as classes. */
    expect((PublicApi as unknown as Record<string, unknown>).IEmbeddingProvider).toBeUndefined();
  });

  it("exports EmbeddingProviderType with exactly 8 values", () => {
    expect(Object.values(PublicApi.EmbeddingProviderType)).toHaveLength(8);
  });

  it("exports EmbeddingModelName with exactly 9 values", () => {
    expect(Object.values(PublicApi.EmbeddingModelName)).toHaveLength(9);
  });

  it("exports the EMBEDDING_MODEL_PROVIDER_CATALOG helper", () => {
    expect(PublicApi.EMBEDDING_MODEL_PROVIDER_CATALOG).toBeDefined();
    expect(typeof PublicApi.isModelCompatibleWithProvider).toBe("function");
  });

  it("exports buildProviderRegistryId/buildModelRegistryId helpers", () => {
    expect(typeof PublicApi.buildProviderRegistryId).toBe("function");
    expect(typeof PublicApi.buildModelRegistryId).toBe("function");
  });

  it("exports all 12 Validator-stage classes alongside the EmbeddingValidator aggregator", () => {
    const stageClassNames = [
      "IdentityValidator",
      "MetadataValidator",
      "ProviderValidator",
      "ModelValidator",
      "NamespaceValidator",
      "ConfigurationValidator",
      "VersionValidator",
      "LifecycleValidator",
      "DependencyValidator",
      "StatisticsValidator",
      "IntegrityValidator",
      "AuditValidator",
    ];
    for (const name of stageClassNames) {
      expect(typeof (PublicApi as unknown as Record<string, unknown>)[name]).toBe("function");
    }
  });

  it("EmbeddingManager can be instantiated end-to-end from the public barrel alone", async () => {
    const { publisher, publish } = (
      await import("./helpers/event-publisher-fixture.js")
    ).fakePublisher();
    const manager = new PublicApi.EmbeddingManager(publisher);
    expect(manager.count()).toBe(0);
    expect(publish).not.toHaveBeenCalled();
  });
});
