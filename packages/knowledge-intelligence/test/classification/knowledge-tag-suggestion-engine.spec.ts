import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeTagSuggestionEngine } from "../../src/classification/knowledge-tag-suggestion-engine.js";
import { KnowledgeSimilarityEngine } from "../../src/similarity/knowledge-similarity-engine.js";
import { resetFixtureState, makeConfig, makeItem } from "../helpers/fixtures.js";

describe("KnowledgeTagSuggestionEngine", () => {
  beforeEach(() => resetFixtureState());

  it("suggests tags from keyword co-occurrence, excluding already-present tags", () => {
    const engine = new KnowledgeTagSuggestionEngine(new KnowledgeSimilarityEngine(makeConfig()));
    const item = makeItem({ tags: ["existing"], keywords: ["billing", "invoice"] });
    const table = {
      billing: ["finance", "existing"],
      invoice: ["accounting"],
    };
    const suggestions = engine.suggestFromCooccurrence(item, table);
    expect(suggestions.sort()).toEqual(["accounting", "finance"]);
  });

  it("ignores keywords that have no co-occurrence table entry", () => {
    const engine = new KnowledgeTagSuggestionEngine(new KnowledgeSimilarityEngine(makeConfig()));
    const item = makeItem({ tags: [], keywords: ["unknown-keyword"] });
    expect(engine.suggestFromCooccurrence(item, { billing: ["finance"] })).toHaveLength(0);
  });

  it("returns no suggestions when the item has no keywords", () => {
    const engine = new KnowledgeTagSuggestionEngine(new KnowledgeSimilarityEngine(makeConfig()));
    const item = makeItem({ keywords: undefined });
    expect(engine.suggestFromCooccurrence(item, { x: ["y"] })).toHaveLength(0);
  });

  it("promotes tags from similar (non-Distinct) corpus items", () => {
    const engine = new KnowledgeTagSuggestionEngine(new KnowledgeSimilarityEngine(makeConfig()));
    const item = makeItem({ id: "a", tags: ["shared1", "shared2"] });
    const similar = makeItem({ id: "b", tags: ["shared1", "shared2", "shared3", "extra-tag"] });
    const distinct = makeItem({ id: "c", tags: ["unrelated"] });
    const suggestions = engine.suggestFromSimilarItems(item, [item, similar, distinct]);
    expect(suggestions).toContain("shared3");
    expect(suggestions).toContain("extra-tag");
    expect(suggestions).not.toContain("unrelated");
  });

  it("excludes the item itself from similar-item promotion", () => {
    const engine = new KnowledgeTagSuggestionEngine(new KnowledgeSimilarityEngine(makeConfig()));
    const item = makeItem({ id: "a", tags: ["a-tag"] });
    expect(engine.suggestFromSimilarItems(item, [item])).toHaveLength(0);
  });
});
