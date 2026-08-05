import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";

describe("Domain Test — KnowledgeIndexType", () => {
  it("declares exactly 17 index types", () => {
    expect(Object.values(KnowledgeIndexType)).toHaveLength(17);
  });

  it("includes every named type from the source prompt", () => {
    const values = Object.values(KnowledgeIndexType);
    expect(values).toContain("keyword");
    expect(values).toContain("embedding_reference");
    expect(values).toContain("hybrid_metadata");
  });
});
