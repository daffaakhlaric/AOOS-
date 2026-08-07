import { describe, expect, it } from "vitest";

import { EmbeddingNotFoundException } from "../../src/errors/embedding-not-found-exception.js";
import { EmbeddingRegistryBucket } from "../../src/registry/embedding-registry-bucket.js";
import { EmbeddingRegistry } from "../../src/registry/embedding-registry.js";
import { EmbeddingResolver } from "../../src/resolver/embedding-resolver.js";

function makeResolver() {
  const registry = new EmbeddingRegistry();
  const resolver = new EmbeddingResolver(registry);
  return { registry, resolver };
}

describe("EmbeddingResolver", () => {
  it("resolveEmbedding() returns a registered Embedding", () => {
    const { registry, resolver } = makeResolver();
    registry.register(EmbeddingRegistryBucket.EMBEDDING, { id: "e-1" });
    expect(resolver.resolveEmbedding("e-1")).toEqual({ id: "e-1" });
  });

  it("resolveEmbedding() throws for a missing Embedding", () => {
    const { resolver } = makeResolver();
    expect(() => resolver.resolveEmbedding("missing")).toThrow(EmbeddingNotFoundException);
  });

  it("tryResolveEmbedding() returns undefined for a missing Embedding", () => {
    const { resolver } = makeResolver();
    expect(resolver.tryResolveEmbedding("missing")).toBeUndefined();
  });

  it("resolveProvider() returns a registered Provider", () => {
    const { registry, resolver } = makeResolver();
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-1" });
    expect(resolver.resolveProvider("p-1")).toEqual({ id: "p-1" });
  });

  it("resolveProvider() throws for a missing Provider", () => {
    const { resolver } = makeResolver();
    expect(() => resolver.resolveProvider("missing")).toThrow(EmbeddingNotFoundException);
  });

  it("resolveModel() returns a registered Model", () => {
    const { registry, resolver } = makeResolver();
    registry.register(EmbeddingRegistryBucket.MODEL, { id: "m-1" });
    expect(resolver.resolveModel("m-1")).toEqual({ id: "m-1" });
  });

  it("resolveModel() throws for a missing Model", () => {
    const { resolver } = makeResolver();
    expect(() => resolver.resolveModel("missing")).toThrow(EmbeddingNotFoundException);
  });

  it("resolveNamespace() returns a registered Namespace", () => {
    const { registry, resolver } = makeResolver();
    registry.register(EmbeddingRegistryBucket.NAMESPACE, { id: "n-1" });
    expect(resolver.resolveNamespace("n-1")).toEqual({ id: "n-1" });
  });

  it("resolveNamespace() throws for a missing Namespace", () => {
    const { resolver } = makeResolver();
    expect(() => resolver.resolveNamespace("missing")).toThrow(EmbeddingNotFoundException);
  });

  it("resolveVersion() returns a registered Version", () => {
    const { registry, resolver } = makeResolver();
    registry.register(EmbeddingRegistryBucket.VERSION, { id: "v-1" });
    expect(resolver.resolveVersion("v-1")).toEqual({ id: "v-1" });
  });

  it("resolveVersion() throws for a missing Version", () => {
    const { resolver } = makeResolver();
    expect(() => resolver.resolveVersion("missing")).toThrow(EmbeddingNotFoundException);
  });

  it("registerConfiguration()/resolveConfiguration() round-trip via the resolver-local map", () => {
    const { resolver } = makeResolver();
    resolver.registerConfiguration({
      id: "cfg-1",
      configurationId: "cfg-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(resolver.resolveConfiguration("cfg-1").configurationId).toBe("cfg-1");
  });

  it("resolveConfiguration() throws for a missing Configuration", () => {
    const { resolver } = makeResolver();
    expect(() => resolver.resolveConfiguration("missing")).toThrow(EmbeddingNotFoundException);
  });

  it("tryResolveConfiguration() returns undefined for a missing Configuration", () => {
    const { resolver } = makeResolver();
    expect(resolver.tryResolveConfiguration("missing")).toBeUndefined();
  });
});
