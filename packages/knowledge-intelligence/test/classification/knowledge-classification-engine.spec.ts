import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeClassificationEngine } from "../../src/classification/knowledge-classification-engine.js";
import { KnowledgeCategory } from "../../src/types/knowledge-category.js";
import { resetFixtureState, makeItem } from "../helpers/fixtures.js";

describe("KnowledgeClassificationEngine", () => {
  beforeEach(() => resetFixtureState());

  it("classifies via an explicit category hint", () => {
    const engine = new KnowledgeClassificationEngine();
    const classification = engine.classify(makeItem({ category: "how_to" }));
    expect(classification.category).toBe(KnowledgeCategory.HowTo);
  });

  it("classifies as DeepDive from long-form content alone", () => {
    const engine = new KnowledgeClassificationEngine();
    const classification = engine.classify(
      makeItem({
        category: undefined,
        contentLength: 2500,
        tags: [],
        hasSummary: false,
        hasExamples: false,
      }),
    );
    expect(classification.category).toBe(KnowledgeCategory.DeepDive);
  });

  it("classifies as Overview from short-form content alone", () => {
    const engine = new KnowledgeClassificationEngine();
    const classification = engine.classify(
      makeItem({
        category: undefined,
        contentLength: 50,
        tags: [],
        hasSummary: false,
        hasExamples: false,
      }),
    );
    expect(classification.category).toBe(KnowledgeCategory.Overview);
  });

  it("classifies as Uncategorized when no rule matches", () => {
    const engine = new KnowledgeClassificationEngine();
    const classification = engine.classify(
      makeItem({
        category: undefined,
        tags: [],
        hasSummary: false,
        hasExamples: false,
        contentLength: 500,
      }),
    );
    expect(classification.category).toBe(KnowledgeCategory.Uncategorized);
    expect(classification.confidence).toBe(0);
    expect(classification.matchedSpecifications).toHaveLength(0);
  });

  it("lowers confidence when multiple rules match", () => {
    const engine = new KnowledgeClassificationEngine();
    // hasExamples true satisfies HowTo; contentLength 50 satisfies Overview too
    const classification = engine.classify(
      makeItem({
        category: undefined,
        contentLength: 50,
        tags: [],
        hasSummary: false,
        hasExamples: true,
      }),
    );
    expect(classification.matchedSpecifications.length).toBeGreaterThan(1);
    expect(classification.confidence).toBeLessThan(1);
  });

  it("classifies all items in a corpus", () => {
    const engine = new KnowledgeClassificationEngine();
    const items = [makeItem({ category: "reference" }), makeItem({ category: "overview" })];
    const results = engine.classifyAll(items);
    expect(results).toHaveLength(2);
  });

  it.each<[string, KnowledgeCategory]>([
    ["reference", KnowledgeCategory.Reference],
    ["how_to", KnowledgeCategory.HowTo],
    ["deep_dive", KnowledgeCategory.DeepDive],
    ["overview", KnowledgeCategory.Overview],
  ])("classifies an explicit category hint %s as %s", (hint, expected) => {
    const engine = new KnowledgeClassificationEngine();
    // Disable every signal besides the hint itself so only HasCategoryHintSpecification matches.
    const item = makeItem({
      category: hint,
      tags: [],
      hasSummary: false,
      hasExamples: false,
      contentLength: 500,
    });
    expect(engine.classify(item).category).toBe(expected);
  });

  it("supports extra caller-registered rules evaluated before the built-ins", () => {
    const custom = {
      category: KnowledgeCategory.Reference,
      specification: { name: "always-true", isSatisfiedBy: () => true },
    };
    const engine = new KnowledgeClassificationEngine([custom]);
    const classification = engine.classify(makeItem());
    expect(classification.matchedSpecifications[0]).toBe("always-true");
  });
});
