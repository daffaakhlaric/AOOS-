import { describe, expect, it } from "vitest";

import { DuplicateRetrievalEntryException } from "../../src/errors/duplicate-retrieval-entry-exception.js";
import { RetrievalNotFoundException } from "../../src/errors/retrieval-not-found-exception.js";
import { KnowledgeRetrievalRegistryBucket } from "../../src/registry/knowledge-retrieval-registry-bucket.js";
import { KnowledgeRetrievalRegistry } from "../../src/registry/knowledge-retrieval-registry.js";

describe("KnowledgeRetrievalRegistryBucket", () => {
  it("has exactly 7 buckets", () => {
    expect(Object.values(KnowledgeRetrievalRegistryBucket)).toHaveLength(7);
  });
});

describe("KnowledgeRetrievalRegistry", () => {
  it("registers and gets an entry", () => {
    const registry = new KnowledgeRetrievalRegistry();
    registry.register(KnowledgeRetrievalRegistryBucket.FILTER, { id: "f-1" });
    expect(registry.get(KnowledgeRetrievalRegistryBucket.FILTER, "f-1")).toEqual({ id: "f-1" });
  });

  it("throws registering a duplicate id in the same bucket", () => {
    const registry = new KnowledgeRetrievalRegistry();
    registry.register(KnowledgeRetrievalRegistryBucket.FILTER, { id: "f-1" });
    expect(() => registry.register(KnowledgeRetrievalRegistryBucket.FILTER, { id: "f-1" })).toThrow(
      DuplicateRetrievalEntryException,
    );
  });

  it("allows the same id in different buckets", () => {
    const registry = new KnowledgeRetrievalRegistry();
    registry.register(KnowledgeRetrievalRegistryBucket.FILTER, { id: "shared" });
    expect(() =>
      registry.register(KnowledgeRetrievalRegistryBucket.POLICY, { id: "shared" }),
    ).not.toThrow();
  });

  it("replace() overwrites an existing entry without throwing", () => {
    const registry = new KnowledgeRetrievalRegistry();
    registry.register(KnowledgeRetrievalRegistryBucket.FILTER, { id: "f-1", value: 1 });
    registry.replace(KnowledgeRetrievalRegistryBucket.FILTER, { id: "f-1", value: 2 });
    expect(registry.get(KnowledgeRetrievalRegistryBucket.FILTER, "f-1")).toEqual({
      id: "f-1",
      value: 2,
    });
  });

  it("get() returns undefined for an unknown id", () => {
    const registry = new KnowledgeRetrievalRegistry();
    expect(registry.get(KnowledgeRetrievalRegistryBucket.FILTER, "missing")).toBeUndefined();
  });

  it("require() throws for an unknown id", () => {
    const registry = new KnowledgeRetrievalRegistry();
    expect(() => registry.require(KnowledgeRetrievalRegistryBucket.FILTER, "missing")).toThrow(
      RetrievalNotFoundException,
    );
  });

  it("require() returns the entry when present", () => {
    const registry = new KnowledgeRetrievalRegistry();
    registry.register(KnowledgeRetrievalRegistryBucket.FILTER, { id: "f-1" });
    expect(registry.require(KnowledgeRetrievalRegistryBucket.FILTER, "f-1")).toEqual({ id: "f-1" });
  });

  it("remove() deletes an entry and returns true", () => {
    const registry = new KnowledgeRetrievalRegistry();
    registry.register(KnowledgeRetrievalRegistryBucket.FILTER, { id: "f-1" });
    expect(registry.remove(KnowledgeRetrievalRegistryBucket.FILTER, "f-1")).toBe(true);
    expect(registry.get(KnowledgeRetrievalRegistryBucket.FILTER, "f-1")).toBeUndefined();
  });

  it("remove() returns false for an unknown id", () => {
    const registry = new KnowledgeRetrievalRegistry();
    expect(registry.remove(KnowledgeRetrievalRegistryBucket.FILTER, "missing")).toBe(false);
  });

  it("list() returns every entry in a bucket", () => {
    const registry = new KnowledgeRetrievalRegistry();
    registry.register(KnowledgeRetrievalRegistryBucket.FILTER, { id: "f-1" });
    registry.register(KnowledgeRetrievalRegistryBucket.FILTER, { id: "f-2" });
    expect(registry.list(KnowledgeRetrievalRegistryBucket.FILTER)).toHaveLength(2);
  });

  it("list() returns an empty array for an untouched bucket", () => {
    const registry = new KnowledgeRetrievalRegistry();
    expect(registry.list(KnowledgeRetrievalRegistryBucket.SEARCH_PROVIDER)).toEqual([]);
  });

  it("count() reports the number of entries in a bucket", () => {
    const registry = new KnowledgeRetrievalRegistry();
    registry.register(KnowledgeRetrievalRegistryBucket.FILTER, { id: "f-1" });
    expect(registry.count(KnowledgeRetrievalRegistryBucket.FILTER)).toBe(1);
    expect(registry.count(KnowledgeRetrievalRegistryBucket.POLICY)).toBe(0);
  });
});
