import { describe, expect, it } from "vitest";

import { ProviderNotFoundException } from "../../src/errors/provider-not-found-exception.js";
import { KnowledgeSynchronizationRegistryBucket } from "../../src/registry/knowledge-synchronization-registry-bucket.js";
import { KnowledgeSynchronizationRegistry } from "../../src/registry/knowledge-synchronization-registry.js";
import { KnowledgeSynchronizationResolver } from "../../src/resolver/knowledge-synchronization-resolver.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { providerFixture } from "../helpers/provider-fixture.js";

describe("KnowledgeSynchronizationResolver", () => {
  it("resolveProvider() returns a registered provider", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, providerFixture());
    const resolver = new KnowledgeSynchronizationResolver(registry);
    expect(resolver.resolveProvider("provider-1")).toBeDefined();
  });

  it("resolveProvider() throws ProviderNotFoundException for an unknown providerId", () => {
    const resolver = new KnowledgeSynchronizationResolver(new KnowledgeSynchronizationRegistry());
    expect(() => resolver.resolveProvider("missing")).toThrow(ProviderNotFoundException);
  });

  it("tryResolveProvider() returns undefined for an unknown providerId", () => {
    const resolver = new KnowledgeSynchronizationResolver(new KnowledgeSynchronizationRegistry());
    expect(resolver.tryResolveProvider("missing")).toBeUndefined();
  });

  it("tryResolveProvider() returns the provider when it exists", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, providerFixture());
    const resolver = new KnowledgeSynchronizationResolver(registry);
    expect(resolver.tryResolveProvider("provider-1")).toBeDefined();
  });

  it("detectChanges() returns an empty array when no ChangeDetector is configured", async () => {
    const resolver = new KnowledgeSynchronizationResolver(new KnowledgeSynchronizationRegistry());
    expect(await resolver.detectChanges(contextFixture())).toEqual([]);
  });

  it("detectChanges() delegates to the configured ChangeDetector", async () => {
    const changes = [
      {
        id: "c-1",
        changeType: "added",
        detectedAt: "2026-01-01T00:00:00.000Z",
        metadata: {},
      },
    ] as never;
    const resolver = new KnowledgeSynchronizationResolver(new KnowledgeSynchronizationRegistry(), {
      id: "detector-1",
      detect: async () => changes,
    });
    expect(await resolver.detectChanges(contextFixture())).toBe(changes);
  });
});
