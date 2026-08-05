import { describe, expect, it } from "vitest";

import { KnowledgeChangeType } from "../../src/domain/knowledge-change-type.js";

describe("KnowledgeChangeType", () => {
  it("has exactly 12 change types", () => {
    expect(Object.values(KnowledgeChangeType)).toHaveLength(12);
  });

  it("includes ADDED, DELETED, CONTENT_HASH_CHANGED", () => {
    expect(KnowledgeChangeType.ADDED).toBe("added");
    expect(KnowledgeChangeType.DELETED).toBe("deleted");
    expect(KnowledgeChangeType.CONTENT_HASH_CHANGED).toBe("content_hash_changed");
  });
});
