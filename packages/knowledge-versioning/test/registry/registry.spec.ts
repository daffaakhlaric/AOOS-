import { describe, expect, it } from "vitest";

import { DuplicateVersionEntryException } from "../../src/errors/duplicate-version-entry-exception.js";
import { VersionNotFoundException } from "../../src/errors/version-not-found-exception.js";
import { KnowledgeVersionRegistryBucket } from "../../src/registry/knowledge-version-registry-bucket.js";
import { KnowledgeVersionRegistry } from "../../src/registry/knowledge-version-registry.js";

describe("KnowledgeVersionRegistry", () => {
  it("exposes exactly 8 buckets", () => {
    expect(Object.values(KnowledgeVersionRegistryBucket)).toHaveLength(8);
  });

  it("registers and gets an entry by id", () => {
    const registry = new KnowledgeVersionRegistry();
    const entry = { id: "e1", value: 1 };
    registry.register(KnowledgeVersionRegistryBucket.VERSION, entry);
    expect(registry.get(KnowledgeVersionRegistryBucket.VERSION, "e1")).toEqual(entry);
  });

  it("rejects registering a duplicate id in the same bucket", () => {
    const registry = new KnowledgeVersionRegistry();
    registry.register(KnowledgeVersionRegistryBucket.VERSION, { id: "e1" });
    expect(() => registry.register(KnowledgeVersionRegistryBucket.VERSION, { id: "e1" })).toThrow(
      DuplicateVersionEntryException,
    );
  });

  it("allows the same id across different buckets", () => {
    const registry = new KnowledgeVersionRegistry();
    registry.register(KnowledgeVersionRegistryBucket.VERSION, { id: "e1" });
    expect(() =>
      registry.register(KnowledgeVersionRegistryBucket.SNAPSHOT, { id: "e1" }),
    ).not.toThrow();
  });

  it("replace() overwrites an existing entry without throwing", () => {
    const registry = new KnowledgeVersionRegistry();
    registry.register(KnowledgeVersionRegistryBucket.VERSION, { id: "e1", v: 1 });
    registry.replace(KnowledgeVersionRegistryBucket.VERSION, { id: "e1", v: 2 });
    expect(registry.get<{ v: number }>(KnowledgeVersionRegistryBucket.VERSION, "e1")?.v).toBe(2);
  });

  it("replace() also works for a bucket with no prior entry", () => {
    const registry = new KnowledgeVersionRegistry();
    registry.replace(KnowledgeVersionRegistryBucket.BRANCH, { id: "b1" });
    expect(registry.get(KnowledgeVersionRegistryBucket.BRANCH, "b1")).toBeTruthy();
  });

  it("get() returns undefined for a missing id", () => {
    const registry = new KnowledgeVersionRegistry();
    expect(registry.get(KnowledgeVersionRegistryBucket.VERSION, "missing")).toBeUndefined();
  });

  it("require() throws VersionNotFoundException for a missing id", () => {
    const registry = new KnowledgeVersionRegistry();
    expect(() => registry.require(KnowledgeVersionRegistryBucket.VERSION, "missing")).toThrow(
      VersionNotFoundException,
    );
  });

  it("require() returns the entry when present", () => {
    const registry = new KnowledgeVersionRegistry();
    registry.register(KnowledgeVersionRegistryBucket.VERSION, { id: "e1" });
    expect(registry.require(KnowledgeVersionRegistryBucket.VERSION, "e1")).toEqual({ id: "e1" });
  });

  it("remove() deletes an entry and reports success/failure", () => {
    const registry = new KnowledgeVersionRegistry();
    registry.register(KnowledgeVersionRegistryBucket.VERSION, { id: "e1" });
    expect(registry.remove(KnowledgeVersionRegistryBucket.VERSION, "e1")).toBe(true);
    expect(registry.remove(KnowledgeVersionRegistryBucket.VERSION, "e1")).toBe(false);
  });

  it("list() and count() reflect registered entries per bucket", () => {
    const registry = new KnowledgeVersionRegistry();
    registry.register(KnowledgeVersionRegistryBucket.VERSION, { id: "e1" });
    registry.register(KnowledgeVersionRegistryBucket.VERSION, { id: "e2" });
    expect(registry.count(KnowledgeVersionRegistryBucket.VERSION)).toBe(2);
    expect(registry.list(KnowledgeVersionRegistryBucket.VERSION)).toHaveLength(2);
  });

  it("count() is 0 for an untouched bucket", () => {
    const registry = new KnowledgeVersionRegistry();
    expect(registry.count(KnowledgeVersionRegistryBucket.LINEAGE)).toBe(0);
    expect(registry.list(KnowledgeVersionRegistryBucket.LINEAGE)).toEqual([]);
  });
});
