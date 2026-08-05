import { describe, expect, it } from "vitest";

import { KnowledgeQueryType } from "../../src/domain/knowledge-query-type.js";

describe("KnowledgeQueryType", () => {
  it("has exactly 13 query types", () => {
    expect(Object.values(KnowledgeQueryType)).toHaveLength(13);
  });

  it("includes SUPPORT, QUESTION, HYBRID, COLLECTION", () => {
    expect(KnowledgeQueryType.SUPPORT).toBe("support");
    expect(KnowledgeQueryType.QUESTION).toBe("question");
    expect(KnowledgeQueryType.HYBRID).toBe("hybrid");
    expect(KnowledgeQueryType.COLLECTION).toBe("collection");
  });
});
