import { describe, expect, it } from "vitest";

import { KnowledgeSourceRegistryBucket } from "../../src/registry/knowledge-source-registry-bucket.js";
import { KnowledgeSourceRegistry } from "../../src/registry/knowledge-source-registry.js";

describe("KnowledgeSourceRegistry additional coverage", () => {
  it("list() on an untouched bucket returns an empty array, not undefined", () => {
    const registry = new KnowledgeSourceRegistry();
    expect(registry.list(KnowledgeSourceRegistryBucket.HEALTH)).toEqual([]);
  });

  it("count() on an untouched bucket returns 0", () => {
    const registry = new KnowledgeSourceRegistry();
    expect(registry.count(KnowledgeSourceRegistryBucket.HEALTH)).toBe(0);
  });

  it("remove() on an untouched bucket returns false", () => {
    const registry = new KnowledgeSourceRegistry();
    expect(registry.remove(KnowledgeSourceRegistryBucket.HEALTH, "missing")).toBe(false);
  });

  it("register() then remove() then register() the same id succeeds", () => {
    const registry = new KnowledgeSourceRegistry();
    registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1" });
    registry.remove(KnowledgeSourceRegistryBucket.SOURCE, "s-1");
    expect(() =>
      registry.register(KnowledgeSourceRegistryBucket.SOURCE, { id: "s-1" }),
    ).not.toThrow();
  });
});
