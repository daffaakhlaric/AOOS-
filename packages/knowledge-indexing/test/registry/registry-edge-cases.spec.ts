import { describe, expect, it } from "vitest";

import { KnowledgeIndexRegistryBucket } from "../../src/registry/knowledge-index-registry-bucket.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";

describe("Registry Test — edge cases", () => {
  it("get() returns undefined for an unknown bucket that was never written to", () => {
    const registry = new KnowledgeIndexRegistry();
    expect(registry.get(KnowledgeIndexRegistryBucket.TEMPLATE, "missing")).toBeUndefined();
  });

  it("list() returns an empty array for a bucket that was never written to", () => {
    const registry = new KnowledgeIndexRegistry();
    expect(registry.list(KnowledgeIndexRegistryBucket.POLICY)).toEqual([]);
  });

  it("remove() returns false for a bucket that was never written to", () => {
    const registry = new KnowledgeIndexRegistry();
    expect(registry.remove(KnowledgeIndexRegistryBucket.RELATIONSHIP, "missing")).toBe(false);
  });

  it("replace() on a brand-new bucket registers the entry without throwing", () => {
    const registry = new KnowledgeIndexRegistry();
    registry.replace(KnowledgeIndexRegistryBucket.STATISTICS, { id: "s-1" });
    expect(registry.count(KnowledgeIndexRegistryBucket.STATISTICS)).toBe(1);
  });
});
