import { describe, expect, it } from "vitest";

import { KnowledgeGeneratorSessionState } from "../../src/domain/knowledge-generator-session-state.js";
import { GeneratorNotFoundException } from "../../src/errors/generator-not-found-exception.js";
import { KnowledgeGeneratorRegistryBucket } from "../../src/registry/knowledge-generator-registry-bucket.js";
import { KnowledgeGeneratorRegistry } from "../../src/registry/knowledge-generator-registry.js";
import { KnowledgeGeneratorResolver } from "../../src/resolver/knowledge-generator-resolver.js";

const now = new Date().toISOString();

function buildResolver(): {
  registry: KnowledgeGeneratorRegistry;
  resolver: KnowledgeGeneratorResolver;
} {
  const registry = new KnowledgeGeneratorRegistry();
  return { registry, resolver: new KnowledgeGeneratorResolver(registry) };
}

describe("KnowledgeGeneratorResolver — Generation Resolver", () => {
  it("resolves a registered Generation", () => {
    const { registry, resolver } = buildResolver();
    registry.register(KnowledgeGeneratorRegistryBucket.GENERATION, {
      id: "g-1",
      generationId: "g-1",
    });
    expect(resolver.resolveGeneration("g-1")).toBeDefined();
    expect(resolver.tryResolveGeneration("g-1")).toBeDefined();
  });

  it("throws GeneratorNotFoundException for an unregistered Generation", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolveGeneration("missing")).toThrow(GeneratorNotFoundException);
  });

  it("tryResolveGeneration() returns undefined for an unregistered Generation", () => {
    const { resolver } = buildResolver();
    expect(resolver.tryResolveGeneration("missing")).toBeUndefined();
  });
});

describe("KnowledgeGeneratorResolver — Prompt Resolver", () => {
  it("resolves a registered Prompt Reference", () => {
    const { registry, resolver } = buildResolver();
    registry.register(KnowledgeGeneratorRegistryBucket.PROMPT, {
      id: "p-1",
      promptId: "p-1",
      promptVersion: "1.0.0",
      namespace: "default",
      createdAt: now,
    });
    expect(resolver.resolvePrompt("p-1").promptId).toBe("p-1");
  });

  it("throws for an unregistered Prompt Reference", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolvePrompt("missing")).toThrow(GeneratorNotFoundException);
  });

  it("tryResolvePrompt() returns undefined when unresolved", () => {
    const { resolver } = buildResolver();
    expect(resolver.tryResolvePrompt("missing")).toBeUndefined();
  });
});

describe("KnowledgeGeneratorResolver — Context Resolver", () => {
  it("resolves a registered Context Reference", () => {
    const { registry, resolver } = buildResolver();
    registry.register(KnowledgeGeneratorRegistryBucket.CONTEXT, {
      id: "c-1",
      contextId: "c-1",
      tenantId: "tenant-1",
      referenceData: {},
      createdAt: now,
    });
    expect(resolver.resolveContext("c-1").contextId).toBe("c-1");
  });

  it("throws for an unregistered Context Reference", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolveContext("missing")).toThrow(GeneratorNotFoundException);
  });

  it("tryResolveContext() returns undefined when unresolved", () => {
    const { resolver } = buildResolver();
    expect(resolver.tryResolveContext("missing")).toBeUndefined();
  });
});

describe("KnowledgeGeneratorResolver — Policy Resolver", () => {
  it("resolves a registered Policy", () => {
    const { registry, resolver } = buildResolver();
    registry.register(KnowledgeGeneratorRegistryBucket.POLICY, {
      id: "pol-1",
      policyId: "pol-1",
      name: "Policy",
      tenantId: "tenant-1",
      allowedAssetTypes: [],
      allowedProviderTypes: [],
      allowedModes: [],
      requireApproval: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    expect(resolver.resolvePolicy("pol-1").policyId).toBe("pol-1");
  });

  it("throws for an unregistered Policy", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolvePolicy("missing")).toThrow(GeneratorNotFoundException);
  });

  it("tryResolvePolicy() returns undefined when unresolved", () => {
    const { resolver } = buildResolver();
    expect(resolver.tryResolvePolicy("missing")).toBeUndefined();
  });
});

describe("KnowledgeGeneratorResolver — Session Resolver", () => {
  it("resolves a registered Generation Session", () => {
    const { registry, resolver } = buildResolver();
    registry.register(KnowledgeGeneratorRegistryBucket.SESSION, {
      id: "s-1",
      sessionId: "s-1",
      generationId: "g-1",
      tenantId: "tenant-1",
      holder: "user-1",
      state: KnowledgeGeneratorSessionState.OPEN,
      openedAt: now,
    });
    expect(resolver.resolveSession("s-1").sessionId).toBe("s-1");
  });

  it("throws for an unregistered Session", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolveSession("missing")).toThrow(GeneratorNotFoundException);
  });

  it("tryResolveSession() returns undefined when unresolved", () => {
    const { resolver } = buildResolver();
    expect(resolver.tryResolveSession("missing")).toBeUndefined();
  });
});
