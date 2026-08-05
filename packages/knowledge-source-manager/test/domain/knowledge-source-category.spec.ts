import { describe, expect, it } from "vitest";

import { KnowledgeSourceCategory } from "../../src/domain/knowledge-source-category.js";

describe("KnowledgeSourceCategory", () => {
  it("has exactly the 12 categories named in the prompt", () => {
    expect(Object.values(KnowledgeSourceCategory)).toEqual([
      "document",
      "repository",
      "cms",
      "storage",
      "database",
      "api",
      "crm",
      "erp",
      "filesystem",
      "cloud",
      "knowledge",
      "custom",
    ]);
  });
});
