import { describe, expect, it } from "vitest";

import { KnowledgeInsight } from "../../src/value-objects/knowledge-insight.js";

describe("KnowledgeInsight", () => {
  it("constructs a valid insight", () => {
    const insight = new KnowledgeInsight({
      id: "insight-1",
      title: "Duplicates found",
      description: "desc",
      severity: "warning",
      relatedItemIds: ["a"],
      createdAt: 1000,
    });
    expect(insight.title).toBe("Duplicates found");
  });

  it("is frozen (immutable), including relatedItemIds", () => {
    const insight = new KnowledgeInsight({
      id: "insight-1",
      title: "x",
      description: "y",
      severity: "info",
      relatedItemIds: [],
      createdAt: 0,
    });
    expect(Object.isFrozen(insight)).toBe(true);
    expect(Object.isFrozen(insight.relatedItemIds)).toBe(true);
  });

  it("throws for an empty title", () => {
    expect(
      () =>
        new KnowledgeInsight({
          id: "insight-1",
          title: "  ",
          description: "y",
          severity: "info",
          relatedItemIds: [],
          createdAt: 0,
        }),
    ).toThrow(RangeError);
  });
});
