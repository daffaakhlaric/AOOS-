import { describe, expect, it } from "vitest";

import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";

describe("KnowledgeProviderCategory", () => {
  it("has exactly 13 categories", () => {
    expect(Object.values(KnowledgeProviderCategory)).toHaveLength(13);
  });

  it("includes DOCUMENT, DATABASE, FUTURE_PROVIDER", () => {
    expect(KnowledgeProviderCategory.DOCUMENT).toBe("document");
    expect(KnowledgeProviderCategory.DATABASE).toBe("database");
    expect(KnowledgeProviderCategory.FUTURE_PROVIDER).toBe("future_provider");
  });
});
