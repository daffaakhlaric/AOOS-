import { describe, expect, it } from "vitest";

import { KnowledgeProviderCapabilityFlag } from "../../src/domain/knowledge-provider-capability-flag.js";
import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";
import { ProviderNotFoundException } from "../../src/errors/provider-not-found-exception.js";
import { KnowledgeProviderRegistryBucket } from "../../src/registry/knowledge-provider-registry-bucket.js";
import { KnowledgeProviderRegistry } from "../../src/registry/knowledge-provider-registry.js";
import { KnowledgeProviderResolver } from "../../src/resolver/knowledge-provider-resolver.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { providerFixture } from "../helpers/provider-fixture.js";

describe("KnowledgeProviderResolver", () => {
  it("resolveById() returns a registered provider", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, providerFixture());
    const resolver = new KnowledgeProviderResolver(registry);
    expect(resolver.resolveById("provider-1")).toBeDefined();
  });

  it("resolveById() throws ProviderNotFoundException for an unknown id", () => {
    const resolver = new KnowledgeProviderResolver(new KnowledgeProviderRegistry());
    expect(() => resolver.resolveById("missing")).toThrow(ProviderNotFoundException);
  });

  it("tryResolveById() returns undefined for an unknown id", () => {
    const resolver = new KnowledgeProviderResolver(new KnowledgeProviderRegistry());
    expect(resolver.tryResolveById("missing")).toBeUndefined();
  });

  it("resolveBySource() is an alias of resolveById()", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, providerFixture());
    const resolver = new KnowledgeProviderResolver(registry);
    expect(resolver.resolveBySource("provider-1")).toEqual(resolver.resolveById("provider-1"));
  });

  it("resolveByType()/resolveByCategory() filter by category", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(
      KnowledgeProviderRegistryBucket.PROVIDER,
      providerFixture({ id: "doc-1", category: KnowledgeProviderCategory.DOCUMENT }),
    );
    registry.register(
      KnowledgeProviderRegistryBucket.PROVIDER,
      providerFixture({ id: "db-1", category: KnowledgeProviderCategory.DATABASE }),
    );
    const resolver = new KnowledgeProviderResolver(registry);
    expect(resolver.resolveByType(KnowledgeProviderCategory.DOCUMENT)).toHaveLength(1);
    expect(resolver.resolveByCategory(KnowledgeProviderCategory.DATABASE)).toHaveLength(1);
  });

  it("resolveByCapability() filters by capability flag", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(
      KnowledgeProviderRegistryBucket.PROVIDER,
      providerFixture({
        id: "p-1",
        capabilities: [KnowledgeProviderCapabilityFlag.SUPPORTS_WRITE],
      }),
    );
    registry.register(
      KnowledgeProviderRegistryBucket.PROVIDER,
      providerFixture({ id: "p-2", capabilities: [KnowledgeProviderCapabilityFlag.SUPPORTS_READ] }),
    );
    const resolver = new KnowledgeProviderResolver(registry);
    expect(
      resolver.resolveByCapability(KnowledgeProviderCapabilityFlag.SUPPORTS_WRITE),
    ).toHaveLength(1);
  });

  it("resolveByNamespace() filters registered Metadata by namespace", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.METADATA, {
      ...metadataFixture({ providerNamespace: "ns-1" }),
      id: "provider-1",
    });
    const resolver = new KnowledgeProviderResolver(registry);
    expect(resolver.resolveByNamespace("ns-1")).toHaveLength(1);
    expect(resolver.resolveByNamespace("ns-missing")).toEqual([]);
  });

  it("resolveByPriority() sorts registered providers by Metadata priority, descending", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, providerFixture({ id: "low" }));
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, providerFixture({ id: "high" }));
    registry.register(KnowledgeProviderRegistryBucket.METADATA, {
      ...metadataFixture({ providerId: "low", providerPriority: 1 }),
      id: "low",
    });
    registry.register(KnowledgeProviderRegistryBucket.METADATA, {
      ...metadataFixture({ providerId: "high", providerPriority: 9 }),
      id: "high",
    });
    const resolver = new KnowledgeProviderResolver(registry);
    expect(resolver.resolveByPriority().map((p) => p.id)).toEqual(["high", "low"]);
  });

  it("resolveByPriority() treats a Provider with no registered Metadata as priority 0", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(
      KnowledgeProviderRegistryBucket.PROVIDER,
      providerFixture({ id: "no-metadata" }),
    );
    registry.register(
      KnowledgeProviderRegistryBucket.PROVIDER,
      providerFixture({ id: "with-metadata" }),
    );
    registry.register(KnowledgeProviderRegistryBucket.METADATA, {
      ...metadataFixture({ providerId: "with-metadata", providerPriority: 5 }),
      id: "with-metadata",
    });
    const resolver = new KnowledgeProviderResolver(registry);
    expect(resolver.resolveByPriority().map((p) => p.id)).toEqual(["with-metadata", "no-metadata"]);
  });

  it("resolveByMetadata() applies a caller-supplied predicate", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.METADATA, {
      ...metadataFixture({ providerName: "Match" }),
      id: "provider-1",
    });
    const resolver = new KnowledgeProviderResolver(registry);
    expect(
      resolver.resolveByMetadata((metadata) => metadata.providerName === "Match"),
    ).toHaveLength(1);
    expect(resolver.resolveByMetadata((metadata) => metadata.providerName === "No Match")).toEqual(
      [],
    );
  });
});
