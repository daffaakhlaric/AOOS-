import { describe, expect, it } from "vitest";

import { DuplicatePolicyEntryException } from "../../src/errors/duplicate-policy-entry-exception.js";
import { PolicyNotFoundException } from "../../src/errors/policy-not-found-exception.js";
import { KnowledgePolicyRegistryBucket } from "../../src/registry/knowledge-policy-registry-bucket.js";
import { KnowledgePolicyRegistry } from "../../src/registry/knowledge-policy-registry.js";

describe("KnowledgePolicyRegistryBucket", () => {
  it("has exactly 7 members", () => {
    expect(Object.values(KnowledgePolicyRegistryBucket)).toHaveLength(7);
  });
});

describe("KnowledgePolicyRegistry", () => {
  it("registers and gets an entry by id", () => {
    const registry = new KnowledgePolicyRegistry();
    const entry = { id: "e1", value: 1 };
    registry.register(KnowledgePolicyRegistryBucket.POLICY, entry);
    expect(registry.get(KnowledgePolicyRegistryBucket.POLICY, "e1")).toEqual(entry);
  });

  it("throws DuplicatePolicyEntryException registering a duplicate id", () => {
    const registry = new KnowledgePolicyRegistry();
    registry.register(KnowledgePolicyRegistryBucket.POLICY, { id: "e1" });
    expect(() => registry.register(KnowledgePolicyRegistryBucket.POLICY, { id: "e1" })).toThrow(
      DuplicatePolicyEntryException,
    );
  });

  it("get() returns undefined for a missing id", () => {
    const registry = new KnowledgePolicyRegistry();
    expect(registry.get(KnowledgePolicyRegistryBucket.POLICY, "missing")).toBeUndefined();
  });

  it("require() throws PolicyNotFoundException for a missing id", () => {
    const registry = new KnowledgePolicyRegistry();
    expect(() => registry.require(KnowledgePolicyRegistryBucket.POLICY, "missing")).toThrow(
      PolicyNotFoundException,
    );
  });

  it("require() returns the entry when present", () => {
    const registry = new KnowledgePolicyRegistry();
    registry.register(KnowledgePolicyRegistryBucket.RULE, { id: "r1" });
    expect(registry.require(KnowledgePolicyRegistryBucket.RULE, "r1")).toEqual({ id: "r1" });
  });

  it("replace() overwrites an existing entry without throwing", () => {
    const registry = new KnowledgePolicyRegistry();
    registry.register(KnowledgePolicyRegistryBucket.POLICY, { id: "e1", value: 1 });
    registry.replace(KnowledgePolicyRegistryBucket.POLICY, { id: "e1", value: 2 });
    expect(registry.get(KnowledgePolicyRegistryBucket.POLICY, "e1")).toEqual({
      id: "e1",
      value: 2,
    });
  });

  it("replace() registers a new entry when it doesn't exist", () => {
    const registry = new KnowledgePolicyRegistry();
    registry.replace(KnowledgePolicyRegistryBucket.SCOPE, { id: "s1" });
    expect(registry.get(KnowledgePolicyRegistryBucket.SCOPE, "s1")).toEqual({ id: "s1" });
  });

  it("remove() deletes an entry and returns true", () => {
    const registry = new KnowledgePolicyRegistry();
    registry.register(KnowledgePolicyRegistryBucket.POLICY, { id: "e1" });
    expect(registry.remove(KnowledgePolicyRegistryBucket.POLICY, "e1")).toBe(true);
    expect(registry.get(KnowledgePolicyRegistryBucket.POLICY, "e1")).toBeUndefined();
  });

  it("remove() returns false for a missing id", () => {
    const registry = new KnowledgePolicyRegistry();
    expect(registry.remove(KnowledgePolicyRegistryBucket.POLICY, "missing")).toBe(false);
  });

  it("list() returns all entries in a bucket", () => {
    const registry = new KnowledgePolicyRegistry();
    registry.register(KnowledgePolicyRegistryBucket.ASSIGNMENT, { id: "a1" });
    registry.register(KnowledgePolicyRegistryBucket.ASSIGNMENT, { id: "a2" });
    expect(registry.list(KnowledgePolicyRegistryBucket.ASSIGNMENT)).toHaveLength(2);
  });

  it("list() returns an empty array for an unused bucket", () => {
    const registry = new KnowledgePolicyRegistry();
    expect(registry.list(KnowledgePolicyRegistryBucket.EVALUATION)).toEqual([]);
  });

  it("count() reflects the bucket size", () => {
    const registry = new KnowledgePolicyRegistry();
    expect(registry.count(KnowledgePolicyRegistryBucket.STATISTICS)).toBe(0);
    registry.register(KnowledgePolicyRegistryBucket.STATISTICS, { id: "s1" });
    expect(registry.count(KnowledgePolicyRegistryBucket.STATISTICS)).toBe(1);
  });

  it("keeps buckets independent from each other", () => {
    const registry = new KnowledgePolicyRegistry();
    registry.register(KnowledgePolicyRegistryBucket.POLICY, { id: "same-id" });
    registry.register(KnowledgePolicyRegistryBucket.SESSION, { id: "same-id" });
    expect(registry.count(KnowledgePolicyRegistryBucket.POLICY)).toBe(1);
    expect(registry.count(KnowledgePolicyRegistryBucket.SESSION)).toBe(1);
  });
});
