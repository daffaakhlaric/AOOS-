import { describe, expect, it } from "vitest";

import { EmbeddingModelName } from "../../src/domain/embedding-model-name.js";
import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import { EmbeddingState } from "../../src/domain/embedding-state.js";
import { EmbeddingFactory } from "../../src/factory/embedding-factory.js";

describe("EmbeddingFactory", () => {
  const factory = new EmbeddingFactory();

  it("composes exactly the 6 documented sub-factories", () => {
    expect(factory.embedding).toBeDefined();
    expect(factory.provider).toBeDefined();
    expect(factory.model).toBeDefined();
    expect(factory.version).toBeDefined();
    expect(factory.metadata).toBeDefined();
    expect(factory.configuration).toBeDefined();
  });

  it("embedding.create() starts in Draft", () => {
    const embedding = factory.embedding.create({
      token: "embt_1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
    });
    expect(embedding.state).toBe(EmbeddingState.DRAFT);
    expect(embedding.id).toBe("e-1");
  });

  it("provider.create() defaults active to true", () => {
    const provider = factory.provider.create({
      providerId: "p-1",
      name: "OpenAI",
      type: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
    });
    expect(provider.active).toBe(true);
  });

  it("provider.create() honors an explicit active flag", () => {
    const provider = factory.provider.create({
      providerId: "p-1",
      name: "OpenAI",
      type: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      active: false,
    });
    expect(provider.active).toBe(false);
  });

  it("model.create() creates a well-formed EmbeddingModel", () => {
    const model = factory.model.create({
      modelId: "m-1",
      name: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
      providerType: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      dimensions: 1536,
    });
    expect(model.dimensions).toBe(1536);
    expect(model.active).toBe(true);
  });

  it("version.create() creates a well-formed EmbeddingVersion", () => {
    const version = factory.version.create({
      versionId: "v-1",
      modelId: "m-1",
      providerType: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      versionLabel: "1.0.0",
    });
    expect(version.versionLabel).toBe("1.0.0");
  });

  it("metadata.create() defaults tags to an empty array", () => {
    const metadata = factory.metadata.create({
      embeddingId: "e-1",
      title: "Title",
      tenantId: "tenant-1",
    });
    expect(metadata.tags).toEqual([]);
  });

  it("metadata.create() copies supplied tags", () => {
    const metadata = factory.metadata.create({
      embeddingId: "e-1",
      title: "Title",
      tenantId: "tenant-1",
      tags: ["a", "b"],
    });
    expect(metadata.tags).toEqual(["a", "b"]);
  });

  it("configuration.create() copies custom knobs", () => {
    const configuration = factory.configuration.create({
      configurationId: "cfg-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      timeoutMs: 5000,
      custom: { key: "value" },
    });
    expect(configuration.timeoutMs).toBe(5000);
    expect(configuration.custom).toEqual({ key: "value" });
  });
});
