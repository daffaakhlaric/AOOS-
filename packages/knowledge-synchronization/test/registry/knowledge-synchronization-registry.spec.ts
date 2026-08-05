import { describe, expect, it } from "vitest";

import { DuplicateSynchronizationEntryException } from "../../src/errors/duplicate-synchronization-entry-exception.js";
import { SynchronizationNotFoundException } from "../../src/errors/synchronization-not-found-exception.js";
import { KnowledgeSynchronizationRegistryBucket } from "../../src/registry/knowledge-synchronization-registry-bucket.js";
import { KnowledgeSynchronizationRegistry } from "../../src/registry/knowledge-synchronization-registry.js";

describe("KnowledgeSynchronizationRegistryBucket", () => {
  it("has exactly 8 buckets", () => {
    expect(Object.values(KnowledgeSynchronizationRegistryBucket)).toHaveLength(8);
  });
});

describe("KnowledgeSynchronizationRegistry", () => {
  it("registers and gets an entry", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, { id: "p-1" });
    expect(registry.get(KnowledgeSynchronizationRegistryBucket.PROVIDER, "p-1")).toEqual({
      id: "p-1",
    });
  });

  it("throws registering a duplicate id in the same bucket", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, { id: "p-1" });
    expect(() =>
      registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, { id: "p-1" }),
    ).toThrow(DuplicateSynchronizationEntryException);
  });

  it("allows the same id in different buckets", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, { id: "shared" });
    expect(() =>
      registry.register(KnowledgeSynchronizationRegistryBucket.POLICY, { id: "shared" }),
    ).not.toThrow();
  });

  it("replace() overwrites an existing entry without throwing", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, { id: "p-1", value: 1 });
    registry.replace(KnowledgeSynchronizationRegistryBucket.PROVIDER, { id: "p-1", value: 2 });
    expect(registry.get(KnowledgeSynchronizationRegistryBucket.PROVIDER, "p-1")).toEqual({
      id: "p-1",
      value: 2,
    });
  });

  it("get() returns undefined for an unknown id", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    expect(
      registry.get(KnowledgeSynchronizationRegistryBucket.PROVIDER, "missing"),
    ).toBeUndefined();
  });

  it("require() throws for an unknown id", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    expect(() =>
      registry.require(KnowledgeSynchronizationRegistryBucket.PROVIDER, "missing"),
    ).toThrow(SynchronizationNotFoundException);
  });

  it("require() returns the entry when present", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, { id: "p-1" });
    expect(registry.require(KnowledgeSynchronizationRegistryBucket.PROVIDER, "p-1")).toEqual({
      id: "p-1",
    });
  });

  it("remove() deletes an entry and returns true", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, { id: "p-1" });
    expect(registry.remove(KnowledgeSynchronizationRegistryBucket.PROVIDER, "p-1")).toBe(true);
    expect(registry.get(KnowledgeSynchronizationRegistryBucket.PROVIDER, "p-1")).toBeUndefined();
  });

  it("remove() returns false for an unknown id", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    expect(registry.remove(KnowledgeSynchronizationRegistryBucket.PROVIDER, "missing")).toBe(false);
  });

  it("list() returns every entry in a bucket", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, { id: "p-1" });
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, { id: "p-2" });
    expect(registry.list(KnowledgeSynchronizationRegistryBucket.PROVIDER)).toHaveLength(2);
  });

  it("list() returns an empty array for an untouched bucket", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    expect(registry.list(KnowledgeSynchronizationRegistryBucket.SCHEDULE)).toEqual([]);
  });

  it("count() reports the number of entries in a bucket", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, { id: "p-1" });
    expect(registry.count(KnowledgeSynchronizationRegistryBucket.PROVIDER)).toBe(1);
    expect(registry.count(KnowledgeSynchronizationRegistryBucket.POLICY)).toBe(0);
  });
});
