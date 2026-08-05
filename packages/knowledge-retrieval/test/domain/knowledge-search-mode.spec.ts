import { describe, expect, it } from "vitest";

import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";

describe("KnowledgeSearchMode", () => {
  it("has exactly 19 search modes", () => {
    expect(Object.values(KnowledgeSearchMode)).toHaveLength(19);
  });

  it("includes KEYWORD, HYBRID, SEMANTIC_REFERENCE, TENANT", () => {
    expect(KnowledgeSearchMode.KEYWORD).toBe("keyword");
    expect(KnowledgeSearchMode.HYBRID).toBe("hybrid");
    expect(KnowledgeSearchMode.SEMANTIC_REFERENCE).toBe("semantic_reference");
    expect(KnowledgeSearchMode.TENANT).toBe("tenant");
  });
});
