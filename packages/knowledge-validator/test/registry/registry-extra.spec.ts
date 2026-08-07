import { describe, expect, it } from "vitest";

import { KnowledgeValidatorRegistryBucket } from "../../src/registry/knowledge-validator-registry-bucket.js";
import { KnowledgeValidatorRegistry } from "../../src/registry/knowledge-validator-registry.js";

describe("KnowledgeValidatorRegistry — every bucket independently", () => {
  it.each(Object.values(KnowledgeValidatorRegistryBucket))(
    "registers and lists entries in the %s bucket without cross-contamination",
    (bucket) => {
      const registry = new KnowledgeValidatorRegistry();
      registry.register(bucket, { id: "entry-1" });
      expect(registry.list(bucket)).toHaveLength(1);
      for (const other of Object.values(KnowledgeValidatorRegistryBucket)) {
        if (other !== bucket) {
          expect(registry.count(other)).toBe(0);
        }
      }
    },
  );
});
