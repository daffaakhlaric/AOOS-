import { describe, expect, it } from "vitest";

import { DuplicateProviderEntryException } from "../../src/errors/duplicate-provider-entry-exception.js";
import { ProviderNotFoundException } from "../../src/errors/provider-not-found-exception.js";
import { KnowledgeProviderRegistryBucket } from "../../src/registry/knowledge-provider-registry-bucket.js";
import { KnowledgeProviderRegistry } from "../../src/registry/knowledge-provider-registry.js";

describe("KnowledgeProviderRegistryBucket", () => {
  it("has exactly 8 buckets", () => {
    expect(Object.values(KnowledgeProviderRegistryBucket)).toHaveLength(8);
  });
});

describe("KnowledgeProviderRegistry", () => {
  it("registers and gets an entry", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, { id: "p-1" });
    expect(registry.get(KnowledgeProviderRegistryBucket.PROVIDER, "p-1")).toEqual({ id: "p-1" });
  });

  it("throws registering a duplicate id in the same bucket", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, { id: "p-1" });
    expect(() =>
      registry.register(KnowledgeProviderRegistryBucket.PROVIDER, { id: "p-1" }),
    ).toThrow(DuplicateProviderEntryException);
  });

  it("allows the same id in different buckets", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, { id: "shared" });
    expect(() =>
      registry.register(KnowledgeProviderRegistryBucket.POLICY, { id: "shared" }),
    ).not.toThrow();
  });

  it("replace() overwrites an existing entry without throwing", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, { id: "p-1", value: 1 });
    registry.replace(KnowledgeProviderRegistryBucket.PROVIDER, { id: "p-1", value: 2 });
    expect(registry.get(KnowledgeProviderRegistryBucket.PROVIDER, "p-1")).toEqual({
      id: "p-1",
      value: 2,
    });
  });

  it("get() returns undefined for an unknown id", () => {
    const registry = new KnowledgeProviderRegistry();
    expect(registry.get(KnowledgeProviderRegistryBucket.PROVIDER, "missing")).toBeUndefined();
  });

  it("require() throws for an unknown id", () => {
    const registry = new KnowledgeProviderRegistry();
    expect(() => registry.require(KnowledgeProviderRegistryBucket.PROVIDER, "missing")).toThrow(
      ProviderNotFoundException,
    );
  });

  it("require() returns the entry when present", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, { id: "p-1" });
    expect(registry.require(KnowledgeProviderRegistryBucket.PROVIDER, "p-1")).toEqual({
      id: "p-1",
    });
  });

  it("remove() deletes an entry and returns true", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, { id: "p-1" });
    expect(registry.remove(KnowledgeProviderRegistryBucket.PROVIDER, "p-1")).toBe(true);
    expect(registry.get(KnowledgeProviderRegistryBucket.PROVIDER, "p-1")).toBeUndefined();
  });

  it("remove() returns false for an unknown id", () => {
    const registry = new KnowledgeProviderRegistry();
    expect(registry.remove(KnowledgeProviderRegistryBucket.PROVIDER, "missing")).toBe(false);
  });

  it("list() returns every entry in a bucket", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, { id: "p-1" });
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, { id: "p-2" });
    expect(registry.list(KnowledgeProviderRegistryBucket.PROVIDER)).toHaveLength(2);
  });

  it("list() returns an empty array for an untouched bucket", () => {
    const registry = new KnowledgeProviderRegistry();
    expect(registry.list(KnowledgeProviderRegistryBucket.SESSION)).toEqual([]);
  });

  it("count() reports the number of entries in a bucket", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, { id: "p-1" });
    expect(registry.count(KnowledgeProviderRegistryBucket.PROVIDER)).toBe(1);
    expect(registry.count(KnowledgeProviderRegistryBucket.POLICY)).toBe(0);
  });
});
