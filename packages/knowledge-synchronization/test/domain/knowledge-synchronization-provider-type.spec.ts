import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationProviderType } from "../../src/domain/knowledge-synchronization-provider-type.js";

describe("KnowledgeSynchronizationProviderType", () => {
  it("has exactly 9 provider types", () => {
    expect(Object.values(KnowledgeSynchronizationProviderType)).toHaveLength(9);
  });

  it("includes DOCUMENT, DATABASE, FUTURE_PROVIDER", () => {
    expect(KnowledgeSynchronizationProviderType.DOCUMENT).toBe("document");
    expect(KnowledgeSynchronizationProviderType.DATABASE).toBe("database");
    expect(KnowledgeSynchronizationProviderType.FUTURE_PROVIDER).toBe("future_provider");
  });
});
