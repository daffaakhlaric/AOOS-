import { describe, expect, it } from "vitest";

import { KnowledgeGapAnalyzer } from "../../src/gap/knowledge-gap-analyzer.js";

describe("KnowledgeGapAnalyzer", () => {
  it("finds uncovered taxonomy topics", () => {
    const analyzer = new KnowledgeGapAnalyzer();
    const taxonomy = [
      { topic: "a", covered: true, itemCount: 1 },
      { topic: "b", covered: false, itemCount: 0 },
    ];
    expect(analyzer.findGaps(taxonomy)).toEqual([{ topic: "b", covered: false, itemCount: 0 }]);
  });

  it("finds orphan items with zero edges in either direction", () => {
    const analyzer = new KnowledgeGapAnalyzer();
    const itemIds = ["a", "b", "c"];
    const adjacency = { a: ["b"] };
    const orphans = analyzer.findOrphans(itemIds, adjacency);
    expect(orphans).toEqual([{ itemId: "c" }]);
  });

  it("counts an item as connected when it only appears as a target", () => {
    const analyzer = new KnowledgeGapAnalyzer();
    const itemIds = ["a", "b"];
    const adjacency = { a: ["b"] };
    expect(analyzer.findOrphans(itemIds, adjacency)).toHaveLength(0);
  });

  it("treats a node with an empty edge list as not connecting via that source", () => {
    const analyzer = new KnowledgeGapAnalyzer();
    const itemIds = ["a", "b"];
    const adjacency = { a: [] };
    const orphans = analyzer.findOrphans(itemIds, adjacency);
    expect(orphans.map((o) => o.itemId).sort()).toEqual(["a", "b"]);
  });

  it("returns no orphans for an empty item list", () => {
    const analyzer = new KnowledgeGapAnalyzer();
    expect(analyzer.findOrphans([], {})).toHaveLength(0);
  });
});
