import { describe, expect, it } from "vitest";

import { KnowledgeCategory } from "../../src/types/knowledge-category.js";

describe("KnowledgeCategory", () => {
  it("includes Uncategorized as the fallback category", () => {
    expect(KnowledgeCategory.Uncategorized).toBe("uncategorized");
  });

  it("has unique values", () => {
    const values = Object.values(KnowledgeCategory);
    expect(new Set(values).size).toBe(values.length);
  });
});
