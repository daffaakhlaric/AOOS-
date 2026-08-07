import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeRelationshipAnalyzer } from "../../src/analysis/knowledge-relationship-analyzer.js";
import { KnowledgeSimilarityEngine } from "../../src/similarity/knowledge-similarity-engine.js";
import { resetFixtureState, makeConfig, makeItem } from "../helpers/fixtures.js";

describe("KnowledgeRelationshipAnalyzer", () => {
  beforeEach(() => resetFixtureState());

  it("discovers a relationship via an explicit caller-declared link", () => {
    const analyzer = new KnowledgeRelationshipAnalyzer(new KnowledgeSimilarityEngine(makeConfig()));
    const a = makeItem({ id: "a", tags: ["x"], linkedItemIds: ["b"] });
    const b = makeItem({ id: "b", tags: ["y"] });
    const relationships = analyzer.discover([a, b]);
    expect(relationships).toEqual([
      { sourceId: "a", targetId: "b", strength: 1, basis: "explicit_link" },
    ]);
  });

  it("discovers a relationship via an explicit link declared only on the second item", () => {
    const analyzer = new KnowledgeRelationshipAnalyzer(new KnowledgeSimilarityEngine(makeConfig()));
    const a = makeItem({ id: "a", tags: ["x"] });
    const b = makeItem({ id: "b", tags: ["y"], linkedItemIds: ["a"] });
    const relationships = analyzer.discover([a, b]);
    expect(relationships).toEqual([
      { sourceId: "a", targetId: "b", strength: 1, basis: "explicit_link" },
    ]);
  });

  it("discovers a relationship via similarity classification", () => {
    const analyzer = new KnowledgeRelationshipAnalyzer(new KnowledgeSimilarityEngine(makeConfig()));
    const a = makeItem({ id: "a", tags: ["x", "y"] });
    const b = makeItem({ id: "b", tags: ["x", "y", "z"] });
    const relationships = analyzer.discover([a, b]);
    expect(relationships[0]).toMatchObject({ sourceId: "a", targetId: "b", basis: "similarity" });
  });

  it("discovers a relationship via shared-tag count when similarity is Distinct", () => {
    const analyzer = new KnowledgeRelationshipAnalyzer(
      new KnowledgeSimilarityEngine(makeConfig()),
      2,
    );
    // 8 total unique tags, 2 shared -> Jaccard well below "related" threshold -> Distinct
    const a = makeItem({ id: "a", tags: ["s1", "s2", "u1", "u2", "u3"] });
    const b = makeItem({ id: "b", tags: ["s1", "s2", "v1", "v2", "v3"] });
    const relationships = analyzer.discover([a, b]);
    expect(relationships[0]).toMatchObject({ sourceId: "a", targetId: "b", basis: "shared_tags" });
  });

  it("finds no relationship for fully disjoint, unlinked items below minSharedTags", () => {
    const analyzer = new KnowledgeRelationshipAnalyzer(
      new KnowledgeSimilarityEngine(makeConfig()),
      2,
    );
    const a = makeItem({ id: "a", tags: ["x"] });
    const b = makeItem({ id: "b", tags: ["y"] });
    expect(analyzer.discover([a, b])).toHaveLength(0);
  });

  it("returns no relationships for a corpus of 0 or 1 items", () => {
    const analyzer = new KnowledgeRelationshipAnalyzer(new KnowledgeSimilarityEngine(makeConfig()));
    expect(analyzer.discover([])).toHaveLength(0);
    expect(analyzer.discover([makeItem({ id: "a" })])).toHaveLength(0);
  });
});
