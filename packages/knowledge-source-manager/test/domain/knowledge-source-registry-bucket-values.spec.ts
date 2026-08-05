import { describe, expect, it } from "vitest";

import { KnowledgeSourceRegistryBucket } from "../../src/registry/knowledge-source-registry-bucket.js";

describe("KnowledgeSourceRegistryBucket individual values", () => {
  it("SOURCE", () => expect(KnowledgeSourceRegistryBucket.SOURCE).toBe("source"));
  it("CATEGORY", () => expect(KnowledgeSourceRegistryBucket.CATEGORY).toBe("category"));
  it("NAMESPACE", () => expect(KnowledgeSourceRegistryBucket.NAMESPACE).toBe("namespace"));
  it("COLLECTION", () => expect(KnowledgeSourceRegistryBucket.COLLECTION).toBe("collection"));
  it("POLICY", () => expect(KnowledgeSourceRegistryBucket.POLICY).toBe("policy"));
  it("PERMISSION", () => expect(KnowledgeSourceRegistryBucket.PERMISSION).toBe("permission"));
  it("STATISTICS", () => expect(KnowledgeSourceRegistryBucket.STATISTICS).toBe("statistics"));
  it("SESSION", () => expect(KnowledgeSourceRegistryBucket.SESSION).toBe("session"));
  it("HEALTH", () => expect(KnowledgeSourceRegistryBucket.HEALTH).toBe("health"));
});
