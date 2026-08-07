import { describe, expect, it } from "vitest";

import { DuplicateValidatorEntryException } from "../../src/errors/duplicate-validator-entry-exception.js";
import { ValidatorNotFoundException } from "../../src/errors/validator-not-found-exception.js";
import { KnowledgeValidatorRegistryBucket } from "../../src/registry/knowledge-validator-registry-bucket.js";
import { KnowledgeValidatorRegistry } from "../../src/registry/knowledge-validator-registry.js";

describe("KnowledgeValidatorRegistryBucket", () => {
  it("has exactly 8 buckets", () => {
    expect(Object.values(KnowledgeValidatorRegistryBucket)).toHaveLength(8);
  });

  it.each([
    ["VALIDATION", "validation"],
    ["SESSION", "session"],
    ["RULE", "rule"],
    ["DECISION", "decision"],
    ["CONFIGURATION", "configuration"],
    ["STATISTICS", "statistics"],
    ["AUDIT", "audit"],
    ["FINDING", "finding"],
  ])("has %s = %s", (key, value) => {
    expect(
      KnowledgeValidatorRegistryBucket[key as keyof typeof KnowledgeValidatorRegistryBucket],
    ).toBe(value);
  });
});

describe("KnowledgeValidatorRegistry", () => {
  it("registers and retrieves an entry", () => {
    const registry = new KnowledgeValidatorRegistry();
    registry.register(KnowledgeValidatorRegistryBucket.RULE, { id: "r-1", value: 1 });
    expect(registry.get(KnowledgeValidatorRegistryBucket.RULE, "r-1")).toEqual({
      id: "r-1",
      value: 1,
    });
  });

  it("throws DuplicateValidatorEntryException on duplicate register", () => {
    const registry = new KnowledgeValidatorRegistry();
    registry.register(KnowledgeValidatorRegistryBucket.RULE, { id: "r-1" });
    expect(() => registry.register(KnowledgeValidatorRegistryBucket.RULE, { id: "r-1" })).toThrow(
      DuplicateValidatorEntryException,
    );
  });

  it("get returns undefined for a missing id", () => {
    const registry = new KnowledgeValidatorRegistry();
    expect(registry.get(KnowledgeValidatorRegistryBucket.RULE, "missing")).toBeUndefined();
  });

  it("require throws ValidatorNotFoundException for a missing id", () => {
    const registry = new KnowledgeValidatorRegistry();
    expect(() => registry.require(KnowledgeValidatorRegistryBucket.RULE, "missing")).toThrow(
      ValidatorNotFoundException,
    );
  });

  it("require returns the entry when present", () => {
    const registry = new KnowledgeValidatorRegistry();
    registry.register(KnowledgeValidatorRegistryBucket.RULE, { id: "r-1" });
    expect(registry.require(KnowledgeValidatorRegistryBucket.RULE, "r-1")).toEqual({ id: "r-1" });
  });

  it("replace overwrites an existing entry without throwing", () => {
    const registry = new KnowledgeValidatorRegistry();
    registry.register(KnowledgeValidatorRegistryBucket.RULE, { id: "r-1", value: 1 });
    registry.replace(KnowledgeValidatorRegistryBucket.RULE, { id: "r-1", value: 2 });
    expect(registry.get(KnowledgeValidatorRegistryBucket.RULE, "r-1")).toEqual({
      id: "r-1",
      value: 2,
    });
  });

  it("replace inserts a new entry when none exists", () => {
    const registry = new KnowledgeValidatorRegistry();
    registry.replace(KnowledgeValidatorRegistryBucket.RULE, { id: "r-1" });
    expect(registry.get(KnowledgeValidatorRegistryBucket.RULE, "r-1")).toEqual({ id: "r-1" });
  });

  it("remove deletes an existing entry and returns true", () => {
    const registry = new KnowledgeValidatorRegistry();
    registry.register(KnowledgeValidatorRegistryBucket.RULE, { id: "r-1" });
    expect(registry.remove(KnowledgeValidatorRegistryBucket.RULE, "r-1")).toBe(true);
    expect(registry.get(KnowledgeValidatorRegistryBucket.RULE, "r-1")).toBeUndefined();
  });

  it("remove returns false for a missing entry", () => {
    const registry = new KnowledgeValidatorRegistry();
    expect(registry.remove(KnowledgeValidatorRegistryBucket.RULE, "missing")).toBe(false);
  });

  it("list returns an empty array for an unused bucket", () => {
    const registry = new KnowledgeValidatorRegistry();
    expect(registry.list(KnowledgeValidatorRegistryBucket.FINDING)).toEqual([]);
  });

  it("list returns every entry in a bucket", () => {
    const registry = new KnowledgeValidatorRegistry();
    registry.register(KnowledgeValidatorRegistryBucket.RULE, { id: "r-1" });
    registry.register(KnowledgeValidatorRegistryBucket.RULE, { id: "r-2" });
    expect(registry.list(KnowledgeValidatorRegistryBucket.RULE)).toHaveLength(2);
  });

  it("count returns 0 for an unused bucket", () => {
    const registry = new KnowledgeValidatorRegistry();
    expect(registry.count(KnowledgeValidatorRegistryBucket.AUDIT)).toBe(0);
  });

  it("count reflects the number of registered entries", () => {
    const registry = new KnowledgeValidatorRegistry();
    registry.register(KnowledgeValidatorRegistryBucket.RULE, { id: "r-1" });
    registry.register(KnowledgeValidatorRegistryBucket.RULE, { id: "r-2" });
    expect(registry.count(KnowledgeValidatorRegistryBucket.RULE)).toBe(2);
  });

  it("keeps buckets isolated from one another", () => {
    const registry = new KnowledgeValidatorRegistry();
    registry.register(KnowledgeValidatorRegistryBucket.RULE, { id: "r-1" });
    expect(registry.get(KnowledgeValidatorRegistryBucket.DECISION, "r-1")).toBeUndefined();
  });
});
