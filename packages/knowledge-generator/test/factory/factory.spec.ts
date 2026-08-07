import { describe, expect, it } from "vitest";

import { KnowledgeGenerationAssetType } from "../../src/domain/knowledge-generation-asset-type.js";
import { KnowledgeGenerationMode } from "../../src/domain/knowledge-generation-mode.js";
import { KnowledgeGenerationProviderType } from "../../src/domain/knowledge-generation-provider-type.js";
import { KnowledgeGenerationState } from "../../src/domain/knowledge-generation-state.js";
import { KnowledgeGeneratorSessionState } from "../../src/domain/knowledge-generator-session-state.js";
import { KnowledgeGeneratorFactory } from "../../src/factory/knowledge-generator-factory.js";

describe("KnowledgeGeneratorFactory", () => {
  const factory = new KnowledgeGeneratorFactory();

  it("composes exactly the 6 named sub-factories", () => {
    expect(factory.generation).toBeDefined();
    expect(factory.request).toBeDefined();
    expect(factory.result).toBeDefined();
    expect(factory.session).toBeDefined();
    expect(factory.prompt).toBeDefined();
    expect(factory.metadata).toBeDefined();
  });

  describe("GenerationFactory", () => {
    it("creates a Draft KnowledgeGeneration", () => {
      const generation = factory.generation.create({
        token: "kgen_1",
        generationId: "g-1",
        tenantId: "tenant-1",
      });
      expect(generation.state).toBe(KnowledgeGenerationState.DRAFT);
      expect(generation.id).toBe("g-1");
    });
  });

  describe("RequestFactory", () => {
    it("creates a KnowledgeGenerationRequest with a fresh requestId", () => {
      const request = factory.request.create({
        generationId: "g-1",
        assetType: KnowledgeGenerationAssetType.FAQ,
        mode: KnowledgeGenerationMode.CREATE,
        providerType: KnowledgeGenerationProviderType.OPENAI,
        requestedBy: "user-1",
      });
      expect(request.requestId).toBeDefined();
      expect(request.generationId).toBe("g-1");
    });
  });

  describe("ResultFactory", () => {
    it("creates a KnowledgeGenerationResult without a generated content field", () => {
      const result = factory.result.create({
        generationId: "g-1",
        providerId: "provider-1",
        providerType: KnowledgeGenerationProviderType.CLAUDE,
        outputMetadata: { tokens: 10 },
      });
      expect(result.generationId).toBe("g-1");
      expect(result.outputMetadata).toEqual({ tokens: 10 });
      expect((result as Record<string, unknown>).content).toBeUndefined();
    });
  });

  describe("SessionFactory", () => {
    it("creates an OPEN KnowledgeGenerationSession", () => {
      const session = factory.session.create({
        generationId: "g-1",
        tenantId: "tenant-1",
        holder: "user-1",
      });
      expect(session.state).toBe(KnowledgeGeneratorSessionState.OPEN);
    });

    it("stamps expiresAt when ttlMs is supplied", () => {
      const session = factory.session.create({
        generationId: "g-1",
        tenantId: "tenant-1",
        holder: "user-1",
        ttlMs: 1000,
      });
      expect(session.expiresAt).toBeDefined();
    });
  });

  describe("PromptFactory", () => {
    it("creates a KnowledgeGenerationPromptReference pointer", () => {
      const prompt = factory.prompt.create({
        promptId: "p-1",
        promptVersion: "1.0.0",
        namespace: "default",
      });
      expect(prompt.promptId).toBe("p-1");
      expect((prompt as Record<string, unknown>).text).toBeUndefined();
    });
  });

  describe("MetadataFactory", () => {
    it("creates a KnowledgeGenerationMetadata record", () => {
      const metadata = factory.metadata.create({
        generationId: "g-1",
        title: "Title",
        tenantId: "tenant-1",
      });
      expect(metadata.title).toBe("Title");
      expect(metadata.tags).toEqual([]);
    });

    it("defaults tags to an empty array when not supplied", () => {
      const metadata = factory.metadata.create({
        generationId: "g-1",
        title: "Title",
        tenantId: "tenant-1",
      });
      expect(metadata.tags).toEqual([]);
    });
  });
});
