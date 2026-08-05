import { describe, expect, it } from "vitest";

import { KnowledgeProviderCapabilityFlag } from "../../src/domain/knowledge-provider-capability-flag.js";

describe("KnowledgeProviderCapabilityFlag", () => {
  it("has exactly 20 capability flags", () => {
    expect(Object.values(KnowledgeProviderCapabilityFlag)).toHaveLength(20);
  });

  it("includes SUPPORTS_READ, SUPPORTS_WRITE, SUPPORTS_RELATIONSHIP", () => {
    expect(KnowledgeProviderCapabilityFlag.SUPPORTS_READ).toBe("supports_read");
    expect(KnowledgeProviderCapabilityFlag.SUPPORTS_WRITE).toBe("supports_write");
    expect(KnowledgeProviderCapabilityFlag.SUPPORTS_RELATIONSHIP).toBe("supports_relationship");
  });
});
