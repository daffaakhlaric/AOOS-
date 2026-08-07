import { describe, expect, it } from "vitest";

import { EmbeddingModelName } from "../../src/domain/embedding-model-name.js";
import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import { EmbeddingFactory } from "../../src/factory/embedding-factory.js";

describe("EmbeddingFactory — extra field defaulting behavior", () => {
  const factory = new EmbeddingFactory();

  it("embedding.create() copies the token/tenantId/workspaceId verbatim", () => {
    const embedding = factory.embedding.create({
      token: "embt_x",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      workspaceId: "ws-1",
    });
    expect(embedding.token).toBe("embt_x");
    expect(embedding.workspaceId).toBe("ws-1");
  });

  it("embedding.create() stamps createdAt === updatedAt on creation", () => {
    const embedding = factory.embedding.create({
      token: "embt_x",
      embeddingId: "e-1",
      tenantId: "tenant-1",
    });
    expect(embedding.createdAt).toBe(embedding.updatedAt);
  });

  it("model.create() defaults active to true when omitted", () => {
    const model = factory.model.create({
      modelId: "m-1",
      name: EmbeddingModelName.CUSTOM,
      providerType: EmbeddingProviderType.CUSTOM_PROVIDER,
      tenantId: "tenant-1",
    });
    expect(model.active).toBe(true);
  });

  it("model.create() honors an explicit inactive flag", () => {
    const model = factory.model.create({
      modelId: "m-1",
      name: EmbeddingModelName.CUSTOM,
      providerType: EmbeddingProviderType.CUSTOM_PROVIDER,
      tenantId: "tenant-1",
      active: false,
    });
    expect(model.active).toBe(false);
  });

  it("version.create() copies an optional compatibilityNotes field", () => {
    const version = factory.version.create({
      versionId: "v-1",
      modelId: "m-1",
      providerType: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      versionLabel: "1.0.0",
      compatibilityNotes: "breaking change in dimension count",
    });
    expect(version.compatibilityNotes).toContain("breaking");
  });

  it("metadata.create() generates a fresh id per call", () => {
    const a = factory.metadata.create({ embeddingId: "e-1", title: "T", tenantId: "tenant-1" });
    const b = factory.metadata.create({ embeddingId: "e-1", title: "T", tenantId: "tenant-1" });
    expect(a.id).not.toBe(b.id);
  });

  it("configuration.create() defaults custom to an empty object", () => {
    const configuration = factory.configuration.create({
      configurationId: "cfg-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
    });
    expect(configuration.custom).toEqual({});
  });

  it("provider.create() copies the name field verbatim", () => {
    const provider = factory.provider.create({
      providerId: "p-1",
      name: "My Custom Provider",
      type: EmbeddingProviderType.CUSTOM_PROVIDER,
      tenantId: "tenant-1",
    });
    expect(provider.name).toBe("My Custom Provider");
  });
});
