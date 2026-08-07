import { describe, expect, it } from "vitest";

import { KnowledgeCategory } from "../../src/types/knowledge-category.js";
import { KnowledgeClassification } from "../../src/value-objects/knowledge-classification.js";

describe("KnowledgeClassification", () => {
  it("constructs a valid classification", () => {
    const classification = new KnowledgeClassification({
      itemId: "item-1",
      category: KnowledgeCategory.Reference,
      confidence: 1,
      matchedSpecifications: ["has_summary"],
    });
    expect(classification.category).toBe(KnowledgeCategory.Reference);
    expect(classification.matchedSpecifications).toEqual(["has_summary"]);
  });

  it("is frozen (immutable), including the matchedSpecifications array", () => {
    const classification = new KnowledgeClassification({
      itemId: "item-1",
      category: KnowledgeCategory.Overview,
      confidence: 0.5,
      matchedSpecifications: [],
    });
    expect(Object.isFrozen(classification)).toBe(true);
    expect(Object.isFrozen(classification.matchedSpecifications)).toBe(true);
  });

  it("throws when confidence is outside [0, 1]", () => {
    expect(
      () =>
        new KnowledgeClassification({
          itemId: "a",
          category: KnowledgeCategory.Overview,
          confidence: -0.1,
          matchedSpecifications: [],
        }),
    ).toThrow(RangeError);
    expect(
      () =>
        new KnowledgeClassification({
          itemId: "a",
          category: KnowledgeCategory.Overview,
          confidence: 1.1,
          matchedSpecifications: [],
        }),
    ).toThrow(RangeError);
  });
});
