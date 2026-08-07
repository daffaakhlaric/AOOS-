import { describe, expect, it } from "vitest";

import { EmbeddingNotFoundException } from "../../src/errors/embedding-not-found-exception.js";
import { EmbeddingRegistryBucket } from "../../src/registry/embedding-registry-bucket.js";
import { EmbeddingRegistry } from "../../src/registry/embedding-registry.js";

describe("EmbeddingRegistry — full bucket matrix", () => {
  it.each(Object.values(EmbeddingRegistryBucket))(
    "register/require/replace/remove/list/count round-trip for bucket %s",
    (bucket) => {
      const registry = new EmbeddingRegistry();
      registry.register(bucket, { id: "a" });
      registry.register(bucket, { id: "b" });
      expect(registry.count(bucket)).toBe(2);
      expect(registry.list(bucket)).toHaveLength(2);
      expect(registry.require<{ id: string }>(bucket, "a").id).toBe("a");
      registry.replace(bucket, { id: "a", extra: true });
      expect(registry.get<{ id: string; extra: boolean }>(bucket, "a")?.extra).toBe(true);
      expect(registry.remove(bucket, "a")).toBe(true);
      expect(registry.count(bucket)).toBe(1);
      expect(() => registry.require(bucket, "a")).toThrow(EmbeddingNotFoundException);
    },
  );

  it("buckets never cross-contaminate", () => {
    const registry = new EmbeddingRegistry();
    for (const bucket of Object.values(EmbeddingRegistryBucket)) {
      registry.register(bucket, { id: "shared-id" });
    }
    for (const bucket of Object.values(EmbeddingRegistryBucket)) {
      expect(registry.count(bucket)).toBe(1);
    }
  });
});
