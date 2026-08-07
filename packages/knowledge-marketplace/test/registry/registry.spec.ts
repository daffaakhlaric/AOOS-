import { beforeEach, describe, expect, it } from "vitest";

import { DuplicateMarketplaceEntryException } from "../../src/errors/duplicate-marketplace-entry-exception.js";
import { MarketplaceNotFoundException } from "../../src/errors/marketplace-not-found-exception.js";
import { KnowledgeMarketplaceRegistryBucket } from "../../src/registry/knowledge-marketplace-registry-bucket.js";
import { KnowledgeMarketplaceRegistry } from "../../src/registry/knowledge-marketplace-registry.js";

describe("KnowledgeMarketplaceRegistry", () => {
  let registry: KnowledgeMarketplaceRegistry;

  beforeEach(() => {
    registry = new KnowledgeMarketplaceRegistry();
  });

  it("has exactly 8 buckets", () => {
    expect(Object.values(KnowledgeMarketplaceRegistryBucket)).toHaveLength(8);
  });

  it("registers and gets an entry", () => {
    registry.register(KnowledgeMarketplaceRegistryBucket.PACKAGE, { id: "p-1" });
    expect(registry.get(KnowledgeMarketplaceRegistryBucket.PACKAGE, "p-1")).toEqual({ id: "p-1" });
  });

  it("get returns undefined for a missing entry", () => {
    expect(registry.get(KnowledgeMarketplaceRegistryBucket.PACKAGE, "missing")).toBeUndefined();
  });

  it("register throws DuplicateMarketplaceEntryException on a repeated id", () => {
    registry.register(KnowledgeMarketplaceRegistryBucket.PACKAGE, { id: "p-1" });
    expect(() =>
      registry.register(KnowledgeMarketplaceRegistryBucket.PACKAGE, { id: "p-1" }),
    ).toThrow(DuplicateMarketplaceEntryException);
  });

  it("replace overwrites an existing entry", () => {
    registry.register(KnowledgeMarketplaceRegistryBucket.PACKAGE, { id: "p-1", name: "a" });
    registry.replace(KnowledgeMarketplaceRegistryBucket.PACKAGE, { id: "p-1", name: "b" });
    expect(
      registry.get<{ name: string }>(KnowledgeMarketplaceRegistryBucket.PACKAGE, "p-1")?.name,
    ).toBe("b");
  });

  it("replace registers a new entry when none existed", () => {
    registry.replace(KnowledgeMarketplaceRegistryBucket.PACKAGE, { id: "p-1" });
    expect(registry.count(KnowledgeMarketplaceRegistryBucket.PACKAGE)).toBe(1);
  });

  it("require returns the entry when present", () => {
    registry.register(KnowledgeMarketplaceRegistryBucket.PACKAGE, { id: "p-1" });
    expect(registry.require(KnowledgeMarketplaceRegistryBucket.PACKAGE, "p-1")).toEqual({
      id: "p-1",
    });
  });

  it("require throws MarketplaceNotFoundException when absent", () => {
    expect(() => registry.require(KnowledgeMarketplaceRegistryBucket.PACKAGE, "missing")).toThrow(
      MarketplaceNotFoundException,
    );
  });

  it("remove deletes an entry and returns true", () => {
    registry.register(KnowledgeMarketplaceRegistryBucket.PACKAGE, { id: "p-1" });
    expect(registry.remove(KnowledgeMarketplaceRegistryBucket.PACKAGE, "p-1")).toBe(true);
    expect(registry.count(KnowledgeMarketplaceRegistryBucket.PACKAGE)).toBe(0);
  });

  it("remove returns false for a missing entry", () => {
    expect(registry.remove(KnowledgeMarketplaceRegistryBucket.PACKAGE, "missing")).toBe(false);
  });

  it("list returns all entries in a bucket", () => {
    registry.register(KnowledgeMarketplaceRegistryBucket.PACKAGE, { id: "p-1" });
    registry.register(KnowledgeMarketplaceRegistryBucket.PACKAGE, { id: "p-2" });
    expect(registry.list(KnowledgeMarketplaceRegistryBucket.PACKAGE)).toHaveLength(2);
  });

  it("count is 0 for an untouched bucket", () => {
    expect(registry.count(KnowledgeMarketplaceRegistryBucket.CERTIFICATION)).toBe(0);
  });

  it.each(Object.values(KnowledgeMarketplaceRegistryBucket))(
    "bucket %s isolates entries from other buckets",
    (bucket) => {
      registry.register(bucket, { id: "shared-id" });
      for (const other of Object.values(KnowledgeMarketplaceRegistryBucket)) {
        if (other === bucket) {
          continue;
        }
        expect(registry.get(other, "shared-id")).toBeUndefined();
      }
    },
  );
});
