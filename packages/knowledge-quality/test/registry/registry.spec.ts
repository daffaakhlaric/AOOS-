import { describe, expect, it } from "vitest";

import { DuplicateQualityEntryException } from "../../src/errors/duplicate-quality-entry-exception.js";
import { QualityNotFoundException } from "../../src/errors/quality-not-found-exception.js";
import { KnowledgeQualityRegistryBucket } from "../../src/registry/knowledge-quality-registry-bucket.js";
import { KnowledgeQualityRegistry } from "../../src/registry/knowledge-quality-registry.js";

describe("KnowledgeQualityRegistryBucket", () => {
  it("has exactly 8 buckets", () => {
    expect(Object.values(KnowledgeQualityRegistryBucket)).toHaveLength(8);
  });

  it("has the exact named buckets from the spec", () => {
    expect(Object.values(KnowledgeQualityRegistryBucket).sort()).toEqual(
      [
        "assessment",
        "session",
        "finding",
        "rule",
        "profile",
        "statistics",
        "audit",
        "configuration",
      ].sort(),
    );
  });
});

describe("KnowledgeQualityRegistry", () => {
  it("registers and gets an entry", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.register(KnowledgeQualityRegistryBucket.ASSESSMENT, { id: "g-1" });
    expect(registry.get(KnowledgeQualityRegistryBucket.ASSESSMENT, "g-1")).toEqual({ id: "g-1" });
  });

  it("rejects registering a duplicate id in the same bucket", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.register(KnowledgeQualityRegistryBucket.ASSESSMENT, { id: "g-1" });
    expect(() =>
      registry.register(KnowledgeQualityRegistryBucket.ASSESSMENT, { id: "g-1" }),
    ).toThrow(DuplicateQualityEntryException);
  });

  it("allows the same id across different buckets", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.register(KnowledgeQualityRegistryBucket.ASSESSMENT, { id: "shared" });
    expect(() =>
      registry.register(KnowledgeQualityRegistryBucket.FINDING, { id: "shared" }),
    ).not.toThrow();
  });

  it("replace() overwrites an existing entry", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.register(KnowledgeQualityRegistryBucket.ASSESSMENT, { id: "g-1", v: 1 });
    registry.replace(KnowledgeQualityRegistryBucket.ASSESSMENT, { id: "g-1", v: 2 });
    expect(registry.get(KnowledgeQualityRegistryBucket.ASSESSMENT, "g-1")).toEqual({
      id: "g-1",
      v: 2,
    });
  });

  it("replace() creates a new entry when absent", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.replace(KnowledgeQualityRegistryBucket.ASSESSMENT, { id: "g-1" });
    expect(registry.get(KnowledgeQualityRegistryBucket.ASSESSMENT, "g-1")).toEqual({ id: "g-1" });
  });

  it("get() returns undefined for an unknown id", () => {
    const registry = new KnowledgeQualityRegistry();
    expect(registry.get(KnowledgeQualityRegistryBucket.ASSESSMENT, "missing")).toBeUndefined();
  });

  it("require() throws QualityNotFoundException for an unknown id", () => {
    const registry = new KnowledgeQualityRegistry();
    expect(() => registry.require(KnowledgeQualityRegistryBucket.ASSESSMENT, "missing")).toThrow(
      QualityNotFoundException,
    );
  });

  it("require() returns the entry for a known id", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.register(KnowledgeQualityRegistryBucket.ASSESSMENT, { id: "g-1" });
    expect(registry.require(KnowledgeQualityRegistryBucket.ASSESSMENT, "g-1")).toEqual({
      id: "g-1",
    });
  });

  it("remove() deletes an entry and returns true", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.register(KnowledgeQualityRegistryBucket.ASSESSMENT, { id: "g-1" });
    expect(registry.remove(KnowledgeQualityRegistryBucket.ASSESSMENT, "g-1")).toBe(true);
    expect(registry.get(KnowledgeQualityRegistryBucket.ASSESSMENT, "g-1")).toBeUndefined();
  });

  it("remove() returns false for an unknown id", () => {
    const registry = new KnowledgeQualityRegistry();
    expect(registry.remove(KnowledgeQualityRegistryBucket.ASSESSMENT, "missing")).toBe(false);
  });

  it("list() returns all entries in a bucket", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.register(KnowledgeQualityRegistryBucket.FINDING, { id: "j-1" });
    registry.register(KnowledgeQualityRegistryBucket.FINDING, { id: "j-2" });
    expect(registry.list(KnowledgeQualityRegistryBucket.FINDING)).toHaveLength(2);
  });

  it("list() returns an empty array for an untouched bucket", () => {
    const registry = new KnowledgeQualityRegistry();
    expect(registry.list(KnowledgeQualityRegistryBucket.AUDIT)).toEqual([]);
  });

  it("count() reflects the number of entries in a bucket", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.register(KnowledgeQualityRegistryBucket.RULE, { id: "p-1" });
    expect(registry.count(KnowledgeQualityRegistryBucket.RULE)).toBe(1);
    expect(registry.count(KnowledgeQualityRegistryBucket.PROFILE)).toBe(0);
  });

  it("keeps buckets independent of one another", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.register(KnowledgeQualityRegistryBucket.RULE, { id: "x" });
    expect(registry.count(KnowledgeQualityRegistryBucket.PROFILE)).toBe(0);
    expect(registry.count(KnowledgeQualityRegistryBucket.RULE)).toBe(1);
  });

  it("replace() does not affect entries in a different bucket with the same id", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.register(KnowledgeQualityRegistryBucket.RULE, { id: "shared", v: 1 });
    registry.replace(KnowledgeQualityRegistryBucket.PROFILE, { id: "shared", v: 2 });
    expect(registry.get(KnowledgeQualityRegistryBucket.RULE, "shared")).toEqual({
      id: "shared",
      v: 1,
    });
  });

  it("remove() only deletes from the targeted bucket", () => {
    const registry = new KnowledgeQualityRegistry();
    registry.register(KnowledgeQualityRegistryBucket.RULE, { id: "shared" });
    registry.register(KnowledgeQualityRegistryBucket.PROFILE, { id: "shared" });
    registry.remove(KnowledgeQualityRegistryBucket.RULE, "shared");
    expect(registry.get(KnowledgeQualityRegistryBucket.RULE, "shared")).toBeUndefined();
    expect(registry.get(KnowledgeQualityRegistryBucket.PROFILE, "shared")).toBeDefined();
  });

  it.each(Object.values(KnowledgeQualityRegistryBucket))(
    "supports register/get for the %s bucket",
    (bucket) => {
      const registry = new KnowledgeQualityRegistry();
      registry.register(bucket, { id: "entry-1" });
      expect(registry.get(bucket, "entry-1")).toEqual({ id: "entry-1" });
    },
  );
});
