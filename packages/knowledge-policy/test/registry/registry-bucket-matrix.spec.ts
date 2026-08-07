import { describe, expect, it } from "vitest";

import { KnowledgePolicyRegistryBucket } from "../../src/registry/knowledge-policy-registry-bucket.js";
import { KnowledgePolicyRegistry } from "../../src/registry/knowledge-policy-registry.js";

const buckets = Object.values(KnowledgePolicyRegistryBucket);

describe("KnowledgePolicyRegistry — per-bucket isolation matrix", () => {
  it.each(buckets)("registers and retrieves an entry in the %s bucket", (bucket) => {
    const registry = new KnowledgePolicyRegistry();
    registry.register(bucket, { id: "entry-1" });
    expect(registry.get(bucket, "entry-1")).toEqual({ id: "entry-1" });
    expect(registry.count(bucket)).toBe(1);
  });

  it.each(buckets)("removes an entry from the %s bucket", (bucket) => {
    const registry = new KnowledgePolicyRegistry();
    registry.register(bucket, { id: "entry-1" });
    expect(registry.remove(bucket, "entry-1")).toBe(true);
    expect(registry.count(bucket)).toBe(0);
  });

  it.each(buckets)("starts the %s bucket empty", (bucket) => {
    const registry = new KnowledgePolicyRegistry();
    expect(registry.count(bucket)).toBe(0);
    expect(registry.list(bucket)).toEqual([]);
  });
});
