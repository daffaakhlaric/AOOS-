import { describe, expect, it } from "vitest";

import { DuplicateIndexEntryException } from "../../src/errors/duplicate-index-entry-exception.js";
import { IndexNotFoundException } from "../../src/errors/index-not-found-exception.js";
import { KnowledgeIndexRegistryBucket } from "../../src/registry/knowledge-index-registry-bucket.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";

describe("Registry Test — KnowledgeIndexRegistry", () => {
  it("register()/get() round-trips an entry", () => {
    const registry = new KnowledgeIndexRegistry();
    registry.register(KnowledgeIndexRegistryBucket.INDEX, { id: "e-1", value: 1 });
    expect(registry.get(KnowledgeIndexRegistryBucket.INDEX, "e-1")).toEqual({
      id: "e-1",
      value: 1,
    });
  });

  it("register() throws DuplicateIndexEntryException for a repeated id in the same bucket", () => {
    const registry = new KnowledgeIndexRegistry();
    registry.register(KnowledgeIndexRegistryBucket.INDEX, { id: "e-1" });
    expect(() => registry.register(KnowledgeIndexRegistryBucket.INDEX, { id: "e-1" })).toThrow(
      DuplicateIndexEntryException,
    );
  });

  it("replace() overwrites an existing entry without throwing", () => {
    const registry = new KnowledgeIndexRegistry();
    registry.register(KnowledgeIndexRegistryBucket.INDEX, { id: "e-1", value: 1 });
    registry.replace(KnowledgeIndexRegistryBucket.INDEX, { id: "e-1", value: 2 });
    expect(registry.get(KnowledgeIndexRegistryBucket.INDEX, "e-1")).toEqual({
      id: "e-1",
      value: 2,
    });
  });

  it("require() throws IndexNotFoundException for an unknown id", () => {
    const registry = new KnowledgeIndexRegistry();
    expect(() => registry.require(KnowledgeIndexRegistryBucket.INDEX, "missing")).toThrow(
      IndexNotFoundException,
    );
  });

  it("remove() deletes an entry and reports whether it existed", () => {
    const registry = new KnowledgeIndexRegistry();
    registry.register(KnowledgeIndexRegistryBucket.INDEX, { id: "e-1" });
    expect(registry.remove(KnowledgeIndexRegistryBucket.INDEX, "e-1")).toBe(true);
    expect(registry.remove(KnowledgeIndexRegistryBucket.INDEX, "e-1")).toBe(false);
  });

  it("list()/count() reflect the current bucket contents, isolated per bucket", () => {
    const registry = new KnowledgeIndexRegistry();
    registry.register(KnowledgeIndexRegistryBucket.INDEX, { id: "e-1" });
    registry.register(KnowledgeIndexRegistryBucket.VERSION, { id: "v-1" });
    expect(registry.list(KnowledgeIndexRegistryBucket.INDEX)).toHaveLength(1);
    expect(registry.count(KnowledgeIndexRegistryBucket.INDEX)).toBe(1);
    expect(registry.count(KnowledgeIndexRegistryBucket.VERSION)).toBe(1);
    expect(registry.count(KnowledgeIndexRegistryBucket.NAMESPACE)).toBe(0);
  });

  it("declares exactly 7 buckets", () => {
    expect(Object.values(KnowledgeIndexRegistryBucket)).toHaveLength(7);
  });
});
