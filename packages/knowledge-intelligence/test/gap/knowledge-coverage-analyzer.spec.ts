import { describe, expect, it } from "vitest";

import { KnowledgeCoverageAnalyzer } from "../../src/gap/knowledge-coverage-analyzer.js";

describe("KnowledgeCoverageAnalyzer", () => {
  it("computes an exact coverage score for a known taxonomy", () => {
    const analyzer = new KnowledgeCoverageAnalyzer();
    const taxonomy = [
      { topic: "a", covered: true, itemCount: 2 },
      { topic: "b", covered: true, itemCount: 1 },
      { topic: "c", covered: false, itemCount: 0 },
      { topic: "d", covered: false, itemCount: 0 },
    ];
    const score = analyzer.score(taxonomy);
    expect(score.value).toBe(50);
    expect(score.band).toBe("sparse");
  });

  it("treats an empty taxonomy as fully covered", () => {
    const analyzer = new KnowledgeCoverageAnalyzer();
    expect(analyzer.score([]).value).toBe(100);
  });

  it("classifies a comprehensive taxonomy correctly", () => {
    const analyzer = new KnowledgeCoverageAnalyzer();
    const taxonomy = Array.from({ length: 10 }, (_, i) => ({
      topic: `t${i}`,
      covered: i < 9,
      itemCount: 1,
    }));
    expect(analyzer.score(taxonomy).band).toBe("comprehensive");
  });

  it("lists uncovered topics", () => {
    const analyzer = new KnowledgeCoverageAnalyzer();
    const taxonomy = [
      { topic: "a", covered: true, itemCount: 1 },
      { topic: "b", covered: false, itemCount: 0 },
    ];
    expect(analyzer.uncoveredTopics(taxonomy)).toEqual([
      { topic: "b", covered: false, itemCount: 0 },
    ]);
  });

  it("lists under-represented (thin) covered topics", () => {
    const analyzer = new KnowledgeCoverageAnalyzer();
    const taxonomy = [
      { topic: "a", covered: true, itemCount: 1 },
      { topic: "b", covered: true, itemCount: 5 },
      { topic: "c", covered: false, itemCount: 0 },
    ];
    expect(analyzer.underRepresentedTopics(taxonomy, 3)).toEqual([
      { topic: "a", covered: true, itemCount: 1 },
    ]);
  });
});
