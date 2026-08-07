import { describe, expect, it } from "vitest";

import { DuplicateGeneratorEntryException } from "../../src/errors/duplicate-generator-entry-exception.js";
import { GeneratorNotFoundException } from "../../src/errors/generator-not-found-exception.js";
import { KnowledgeGeneratorRegistryBucket } from "../../src/registry/knowledge-generator-registry-bucket.js";
import { KnowledgeGeneratorRegistry } from "../../src/registry/knowledge-generator-registry.js";

describe("KnowledgeGeneratorRegistryBucket", () => {
  it("has exactly 8 buckets", () => {
    expect(Object.values(KnowledgeGeneratorRegistryBucket)).toHaveLength(8);
  });

  it("has the exact named buckets from the spec", () => {
    expect(Object.values(KnowledgeGeneratorRegistryBucket).sort()).toEqual(
      ["generation", "session", "job", "prompt", "context", "policy", "statistics", "audit"].sort(),
    );
  });
});

describe("KnowledgeGeneratorRegistry", () => {
  it("registers and gets an entry", () => {
    const registry = new KnowledgeGeneratorRegistry();
    registry.register(KnowledgeGeneratorRegistryBucket.GENERATION, { id: "g-1" });
    expect(registry.get(KnowledgeGeneratorRegistryBucket.GENERATION, "g-1")).toEqual({ id: "g-1" });
  });

  it("rejects registering a duplicate id in the same bucket", () => {
    const registry = new KnowledgeGeneratorRegistry();
    registry.register(KnowledgeGeneratorRegistryBucket.GENERATION, { id: "g-1" });
    expect(() =>
      registry.register(KnowledgeGeneratorRegistryBucket.GENERATION, { id: "g-1" }),
    ).toThrow(DuplicateGeneratorEntryException);
  });

  it("allows the same id across different buckets", () => {
    const registry = new KnowledgeGeneratorRegistry();
    registry.register(KnowledgeGeneratorRegistryBucket.GENERATION, { id: "shared" });
    expect(() =>
      registry.register(KnowledgeGeneratorRegistryBucket.JOB, { id: "shared" }),
    ).not.toThrow();
  });

  it("replace() overwrites an existing entry", () => {
    const registry = new KnowledgeGeneratorRegistry();
    registry.register(KnowledgeGeneratorRegistryBucket.GENERATION, { id: "g-1", v: 1 });
    registry.replace(KnowledgeGeneratorRegistryBucket.GENERATION, { id: "g-1", v: 2 });
    expect(registry.get(KnowledgeGeneratorRegistryBucket.GENERATION, "g-1")).toEqual({
      id: "g-1",
      v: 2,
    });
  });

  it("replace() creates a new entry when absent", () => {
    const registry = new KnowledgeGeneratorRegistry();
    registry.replace(KnowledgeGeneratorRegistryBucket.GENERATION, { id: "g-1" });
    expect(registry.get(KnowledgeGeneratorRegistryBucket.GENERATION, "g-1")).toEqual({ id: "g-1" });
  });

  it("get() returns undefined for an unknown id", () => {
    const registry = new KnowledgeGeneratorRegistry();
    expect(registry.get(KnowledgeGeneratorRegistryBucket.GENERATION, "missing")).toBeUndefined();
  });

  it("require() throws GeneratorNotFoundException for an unknown id", () => {
    const registry = new KnowledgeGeneratorRegistry();
    expect(() => registry.require(KnowledgeGeneratorRegistryBucket.GENERATION, "missing")).toThrow(
      GeneratorNotFoundException,
    );
  });

  it("require() returns the entry for a known id", () => {
    const registry = new KnowledgeGeneratorRegistry();
    registry.register(KnowledgeGeneratorRegistryBucket.GENERATION, { id: "g-1" });
    expect(registry.require(KnowledgeGeneratorRegistryBucket.GENERATION, "g-1")).toEqual({
      id: "g-1",
    });
  });

  it("remove() deletes an entry and returns true", () => {
    const registry = new KnowledgeGeneratorRegistry();
    registry.register(KnowledgeGeneratorRegistryBucket.GENERATION, { id: "g-1" });
    expect(registry.remove(KnowledgeGeneratorRegistryBucket.GENERATION, "g-1")).toBe(true);
    expect(registry.get(KnowledgeGeneratorRegistryBucket.GENERATION, "g-1")).toBeUndefined();
  });

  it("remove() returns false for an unknown id", () => {
    const registry = new KnowledgeGeneratorRegistry();
    expect(registry.remove(KnowledgeGeneratorRegistryBucket.GENERATION, "missing")).toBe(false);
  });

  it("list() returns all entries in a bucket", () => {
    const registry = new KnowledgeGeneratorRegistry();
    registry.register(KnowledgeGeneratorRegistryBucket.JOB, { id: "j-1" });
    registry.register(KnowledgeGeneratorRegistryBucket.JOB, { id: "j-2" });
    expect(registry.list(KnowledgeGeneratorRegistryBucket.JOB)).toHaveLength(2);
  });

  it("list() returns an empty array for an untouched bucket", () => {
    const registry = new KnowledgeGeneratorRegistry();
    expect(registry.list(KnowledgeGeneratorRegistryBucket.AUDIT)).toEqual([]);
  });

  it("count() reflects the number of entries in a bucket", () => {
    const registry = new KnowledgeGeneratorRegistry();
    registry.register(KnowledgeGeneratorRegistryBucket.PROMPT, { id: "p-1" });
    expect(registry.count(KnowledgeGeneratorRegistryBucket.PROMPT)).toBe(1);
    expect(registry.count(KnowledgeGeneratorRegistryBucket.CONTEXT)).toBe(0);
  });

  it("keeps buckets independent of one another", () => {
    const registry = new KnowledgeGeneratorRegistry();
    registry.register(KnowledgeGeneratorRegistryBucket.PROMPT, { id: "x" });
    expect(registry.count(KnowledgeGeneratorRegistryBucket.CONTEXT)).toBe(0);
    expect(registry.count(KnowledgeGeneratorRegistryBucket.PROMPT)).toBe(1);
  });

  it.each(Object.values(KnowledgeGeneratorRegistryBucket))(
    "supports register/get for the %s bucket",
    (bucket) => {
      const registry = new KnowledgeGeneratorRegistry();
      registry.register(bucket, { id: "entry-1" });
      expect(registry.get(bucket, "entry-1")).toEqual({ id: "entry-1" });
    },
  );
});
