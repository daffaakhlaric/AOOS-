import { describe, expect, it } from "vitest";

import { DuplicateSourceEntryException } from "../../src/errors/duplicate-source-entry-exception.js";
import { SourceNotFoundException } from "../../src/errors/source-not-found-exception.js";
import { KnowledgeSourceRegistryBucket } from "../../src/registry/knowledge-source-registry-bucket.js";
import { KnowledgeSourceRegistry } from "../../src/registry/knowledge-source-registry.js";

describe("KnowledgeSourceRegistryBucket", () => {
  it("has exactly the 9 buckets named in the prompt", () => {
    expect(Object.values(KnowledgeSourceRegistryBucket)).toEqual([
      "source",
      "category",
      "namespace",
      "collection",
      "policy",
      "permission",
      "statistics",
      "session",
      "health",
    ]);
  });
});

describe("KnowledgeSourceRegistry", () => {
  it("registers and gets an entry", () => {
    const registry = new KnowledgeSourceRegistry();
    registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1" });
    expect(registry.get(KnowledgeSourceRegistryBucket.SOURCE, "s-1")).toEqual({ id: "s-1" });
  });

  it("throws DuplicateSourceEntryException on a duplicate register", () => {
    const registry = new KnowledgeSourceRegistry();
    registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1" });
    expect(() => registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1" })).toThrow(
      DuplicateSourceEntryException,
    );
  });

  it("replace overwrites an existing entry without throwing", () => {
    const registry = new KnowledgeSourceRegistry();
    registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1", v: 1 });
    registry.replace(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1", v: 2 });
    expect(registry.get(KnowledgeSourceRegistryBucket.SOURCE, "s-1")).toEqual({ id: "s-1", v: 2 });
  });

  it("get returns undefined for an unknown id", () => {
    const registry = new KnowledgeSourceRegistry();
    expect(registry.get(KnowledgeSourceRegistryBucket.SOURCE, "missing")).toBeUndefined();
  });

  it("require throws SourceNotFoundException for an unknown id", () => {
    const registry = new KnowledgeSourceRegistry();
    expect(() => registry.require(KnowledgeSourceRegistryBucket.SOURCE, "missing")).toThrow(
      SourceNotFoundException,
    );
  });

  it("require returns the entry for a known id", () => {
    const registry = new KnowledgeSourceRegistry();
    registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1" });
    expect(registry.require(KnowledgeSourceRegistryBucket.SOURCE, "s-1")).toEqual({ id: "s-1" });
  });

  it("removes an entry", () => {
    const registry = new KnowledgeSourceRegistry();
    registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1" });
    expect(registry.remove(KnowledgeSourceRegistryBucket.SOURCE, "s-1")).toBe(true);
    expect(registry.remove(KnowledgeSourceRegistryBucket.SOURCE, "s-1")).toBe(false);
  });

  it("lists all entries in a bucket", () => {
    const registry = new KnowledgeSourceRegistry();
    registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1" });
    registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-2" });
    expect(registry.list(KnowledgeSourceRegistryBucket.SOURCE)).toHaveLength(2);
  });

  it("counts entries in a bucket", () => {
    const registry = new KnowledgeSourceRegistry();
    expect(registry.count(KnowledgeSourceRegistryBucket.SOURCE)).toBe(0);
    registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1" });
    expect(registry.count(KnowledgeSourceRegistryBucket.SOURCE)).toBe(1);
  });

  it("keeps buckets independent", () => {
    const registry = new KnowledgeSourceRegistry();
    registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "same-id" });
    expect(() =>
      registry.register(KnowledgeSourceRegistryBucket.POLICY, { id: "same-id" }),
    ).not.toThrow();
  });
});
