import { describe, expect, it } from "vitest";

import { KnowledgeProviderStatus } from "../../src/domain/knowledge-provider-status.js";

describe("KnowledgeProviderStatus", () => {
  it("has exactly 3 statuses", () => {
    expect(Object.values(KnowledgeProviderStatus)).toHaveLength(3);
  });

  it("includes ACTIVE, INACTIVE, DEPRECATED", () => {
    expect(KnowledgeProviderStatus.ACTIVE).toBe("active");
    expect(KnowledgeProviderStatus.INACTIVE).toBe("inactive");
    expect(KnowledgeProviderStatus.DEPRECATED).toBe("deprecated");
  });
});
