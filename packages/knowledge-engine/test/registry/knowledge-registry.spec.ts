import { describe, expect, it } from "vitest";

import { AssetNotFoundException } from "../../src/errors/asset-not-found-exception.js";
import { DuplicateAssetException } from "../../src/errors/duplicate-asset-exception.js";
import { KnowledgeRegistryBucket } from "../../src/registry/knowledge-registry-bucket.js";
import { KnowledgeRegistry } from "../../src/registry/knowledge-registry.js";

describe("Registry Test — KnowledgeRegistry", () => {
  it("register() then get() returns the registered entry", () => {
    const registry = new KnowledgeRegistry();
    const entry = { id: "cat-1", name: "Sales" };
    registry.register(KnowledgeRegistryBucket.CATEGORY, entry);
    expect(registry.get(KnowledgeRegistryBucket.CATEGORY, "cat-1")).toBe(entry);
  });

  it("register() throws DuplicateAssetException for a duplicate id in the same bucket", () => {
    const registry = new KnowledgeRegistry();
    registry.register(KnowledgeRegistryBucket.CATEGORY, { id: "cat-1" });
    expect(() => registry.register(KnowledgeRegistryBucket.CATEGORY, { id: "cat-1" })).toThrow(
      DuplicateAssetException,
    );
  });

  it("the same id is allowed across two different buckets", () => {
    const registry = new KnowledgeRegistry();
    registry.register(KnowledgeRegistryBucket.CATEGORY, { id: "shared" });
    expect(() =>
      registry.register(KnowledgeRegistryBucket.TEMPLATE, { id: "shared" }),
    ).not.toThrow();
  });

  it("require() throws AssetNotFoundException when nothing is registered", () => {
    const registry = new KnowledgeRegistry();
    expect(() => registry.require(KnowledgeRegistryBucket.POLICY, "missing")).toThrow(
      AssetNotFoundException,
    );
  });

  it("require() returns the registered entry", () => {
    const registry = new KnowledgeRegistry();
    const entry = { id: "policy-1" };
    registry.register(KnowledgeRegistryBucket.POLICY, entry);
    expect(registry.require(KnowledgeRegistryBucket.POLICY, "policy-1")).toBe(entry);
  });

  it("replace() overwrites an existing entry without throwing", () => {
    const registry = new KnowledgeRegistry();
    registry.register(KnowledgeRegistryBucket.TEMPLATE, { id: "t-1", version: "1.0.0" });
    const replacement = { id: "t-1", version: "2.0.0" };
    registry.replace(KnowledgeRegistryBucket.TEMPLATE, replacement);
    expect(registry.get(KnowledgeRegistryBucket.TEMPLATE, "t-1")).toBe(replacement);
  });

  it("replace() also works when nothing was previously registered", () => {
    const registry = new KnowledgeRegistry();
    const entry = { id: "t-1" };
    registry.replace(KnowledgeRegistryBucket.TEMPLATE, entry);
    expect(registry.get(KnowledgeRegistryBucket.TEMPLATE, "t-1")).toBe(entry);
  });

  it("remove() deletes an entry and returns true", () => {
    const registry = new KnowledgeRegistry();
    registry.register(KnowledgeRegistryBucket.LIBRARY, { id: "lib-1" });
    expect(registry.remove(KnowledgeRegistryBucket.LIBRARY, "lib-1")).toBe(true);
    expect(registry.get(KnowledgeRegistryBucket.LIBRARY, "lib-1")).toBeUndefined();
  });

  it("remove() returns false when nothing matches", () => {
    const registry = new KnowledgeRegistry();
    expect(registry.remove(KnowledgeRegistryBucket.LIBRARY, "missing")).toBe(false);
  });

  it("list() returns every entry registered in one bucket", () => {
    const registry = new KnowledgeRegistry();
    registry.register(KnowledgeRegistryBucket.COLLECTION, { id: "c-1" });
    registry.register(KnowledgeRegistryBucket.COLLECTION, { id: "c-2" });
    expect(registry.list(KnowledgeRegistryBucket.COLLECTION)).toHaveLength(2);
  });

  it("list() returns an empty array for an untouched bucket", () => {
    const registry = new KnowledgeRegistry();
    expect(registry.list(KnowledgeRegistryBucket.VERSION)).toEqual([]);
  });

  it("count() reports the number of entries in one bucket", () => {
    const registry = new KnowledgeRegistry();
    registry.register(KnowledgeRegistryBucket.RELATIONSHIP, { id: "r-1" });
    expect(registry.count(KnowledgeRegistryBucket.RELATIONSHIP)).toBe(1);
    expect(registry.count(KnowledgeRegistryBucket.NAMESPACE)).toBe(0);
  });

  it("declares 10 registry buckets", () => {
    expect(Object.values(KnowledgeRegistryBucket)).toHaveLength(10);
  });
});
