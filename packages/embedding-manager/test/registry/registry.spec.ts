import { describe, expect, it } from "vitest";

import { DuplicateEmbeddingEntryException } from "../../src/errors/duplicate-embedding-entry-exception.js";
import { EmbeddingNotFoundException } from "../../src/errors/embedding-not-found-exception.js";
import { EmbeddingRegistryBucket } from "../../src/registry/embedding-registry-bucket.js";
import { EmbeddingRegistry } from "../../src/registry/embedding-registry.js";

describe("EmbeddingRegistryBucket", () => {
  it("has exactly the 8 documented buckets", () => {
    expect(Object.values(EmbeddingRegistryBucket)).toHaveLength(8);
    expect(Object.values(EmbeddingRegistryBucket).sort()).toEqual(
      [
        "embedding",
        "provider",
        "model",
        "version",
        "namespace",
        "session",
        "statistics",
        "audit",
      ].sort(),
    );
  });
});

describe("EmbeddingRegistry", () => {
  it("register() stores an entry retrievable by id", () => {
    const registry = new EmbeddingRegistry();
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-1", name: "OpenAI" });
    expect(registry.get(EmbeddingRegistryBucket.PROVIDER, "p-1")).toEqual({
      id: "p-1",
      name: "OpenAI",
    });
  });

  it("register() throws DuplicateEmbeddingEntryException on a colliding id", () => {
    const registry = new EmbeddingRegistry();
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-1" });
    expect(() => registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-1" })).toThrow(
      DuplicateEmbeddingEntryException,
    );
  });

  it("register() keeps buckets isolated", () => {
    const registry = new EmbeddingRegistry();
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "same-id" });
    expect(() => registry.register(EmbeddingRegistryBucket.MODEL, { id: "same-id" })).not.toThrow();
  });

  it("get() returns undefined for a missing id", () => {
    const registry = new EmbeddingRegistry();
    expect(registry.get(EmbeddingRegistryBucket.PROVIDER, "missing")).toBeUndefined();
  });

  it("require() throws EmbeddingNotFoundException for a missing id", () => {
    const registry = new EmbeddingRegistry();
    expect(() => registry.require(EmbeddingRegistryBucket.PROVIDER, "missing")).toThrow(
      EmbeddingNotFoundException,
    );
  });

  it("require() returns the entry for a known id", () => {
    const registry = new EmbeddingRegistry();
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-1" });
    expect(registry.require(EmbeddingRegistryBucket.PROVIDER, "p-1")).toEqual({ id: "p-1" });
  });

  it("replace() overwrites an existing entry without throwing", () => {
    const registry = new EmbeddingRegistry();
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-1", name: "a" });
    registry.replace(EmbeddingRegistryBucket.PROVIDER, { id: "p-1", name: "b" });
    expect(
      registry.get<{ id: string; name: string }>(EmbeddingRegistryBucket.PROVIDER, "p-1")?.name,
    ).toBe("b");
  });

  it("replace() creates the entry when it did not exist", () => {
    const registry = new EmbeddingRegistry();
    registry.replace(EmbeddingRegistryBucket.PROVIDER, { id: "p-1" });
    expect(registry.get(EmbeddingRegistryBucket.PROVIDER, "p-1")).toBeDefined();
  });

  it("remove() deletes an existing entry and returns true", () => {
    const registry = new EmbeddingRegistry();
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-1" });
    expect(registry.remove(EmbeddingRegistryBucket.PROVIDER, "p-1")).toBe(true);
    expect(registry.get(EmbeddingRegistryBucket.PROVIDER, "p-1")).toBeUndefined();
  });

  it("remove() returns false for a missing id", () => {
    const registry = new EmbeddingRegistry();
    expect(registry.remove(EmbeddingRegistryBucket.PROVIDER, "missing")).toBe(false);
  });

  it("list() returns all entries in a bucket", () => {
    const registry = new EmbeddingRegistry();
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-1" });
    registry.register(EmbeddingRegistryBucket.PROVIDER, { id: "p-2" });
    expect(registry.list(EmbeddingRegistryBucket.PROVIDER)).toHaveLength(2);
  });

  it("list() returns an empty array for an empty bucket", () => {
    const registry = new EmbeddingRegistry();
    expect(registry.list(EmbeddingRegistryBucket.PROVIDER)).toEqual([]);
  });

  it("count() reflects the number of entries", () => {
    const registry = new EmbeddingRegistry();
    registry.register(EmbeddingRegistryBucket.MODEL, { id: "m-1" });
    expect(registry.count(EmbeddingRegistryBucket.MODEL)).toBe(1);
  });

  it.each(Object.values(EmbeddingRegistryBucket))(
    "supports register/get for bucket %s",
    (bucket) => {
      const registry = new EmbeddingRegistry();
      registry.register(bucket, { id: "x-1" });
      expect(registry.get(bucket, "x-1")).toEqual({ id: "x-1" });
    },
  );
});
