import { describe, expect, it } from "vitest";

import { EmbeddingRegistryBucket } from "../../src/registry/embedding-registry-bucket.js";
import { EmbeddingRegistry } from "../../src/registry/embedding-registry.js";
import { EmbeddingResolver } from "../../src/resolver/embedding-resolver.js";

describe("EmbeddingResolver — extra scenarios", () => {
  it("resolving each of the 5 named dimensions is independent (no cross-talk)", () => {
    const registry = new EmbeddingRegistry();
    const resolver = new EmbeddingResolver(registry);
    registry.register(EmbeddingRegistryBucket.EMBEDDING, { id: "shared-id", kind: "embedding" });
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "shared-id", kind: "provider" });
    expect((resolver.resolveEmbedding("shared-id") as { kind: string }).kind).toBe("embedding");
    expect((resolver.resolveProvider("shared-id") as { kind: string }).kind).toBe("provider");
  });

  it("registerConfiguration() overwrites a previously registered Configuration with the same id", () => {
    const resolver = new EmbeddingResolver(new EmbeddingRegistry());
    resolver.registerConfiguration({
      id: "cfg-1",
      configurationId: "cfg-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      timeoutMs: 1000,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    resolver.registerConfiguration({
      id: "cfg-1",
      configurationId: "cfg-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      timeoutMs: 2000,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(resolver.resolveConfiguration("cfg-1").timeoutMs).toBe(2000);
  });

  it("the Configuration map is resolver-local, not shared with the Registry's buckets", () => {
    const registry = new EmbeddingRegistry();
    const resolver = new EmbeddingResolver(registry);
    resolver.registerConfiguration({
      id: "cfg-1",
      configurationId: "cfg-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    for (const bucket of Object.values(EmbeddingRegistryBucket)) {
      expect(registry.get(bucket, "cfg-1")).toBeUndefined();
    }
  });
});
