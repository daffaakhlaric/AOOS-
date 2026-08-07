import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeQualityScoringEngine } from "../../src/scoring/knowledge-quality-scoring-engine.js";
import { resetFixtureState, makeItem } from "../helpers/fixtures.js";

describe("KnowledgeQualityScoringEngine", () => {
  beforeEach(() => {
    resetFixtureState();
  });

  it("scores a fully complete, richly-structured, adequately-long item highly", () => {
    const engine = new KnowledgeQualityScoringEngine();
    const item = makeItem({
      requiredFieldsPresent: 4,
      requiredFieldsTotal: 4,
      hasSummary: true,
      hasExamples: true,
      hasOwner: true,
      contentLength: 600,
    });
    const score = engine.score(item);
    expect(score.value).toBe(100);
    expect(score.band).toBe("excellent");
  });

  it("scores an incomplete, structurally-poor, short item lowly", () => {
    const engine = new KnowledgeQualityScoringEngine();
    const item = makeItem({
      requiredFieldsPresent: 0,
      requiredFieldsTotal: 4,
      hasSummary: false,
      hasExamples: false,
      hasOwner: false,
      contentLength: 0,
    });
    const score = engine.score(item);
    expect(score.value).toBe(0);
    expect(score.band).toBe("poor");
  });

  it("treats an item with no required fields as fully complete", () => {
    const engine = new KnowledgeQualityScoringEngine();
    const item = makeItem({ requiredFieldsPresent: 0, requiredFieldsTotal: 0 });
    const score = engine.score(item);
    expect(score.value).toBeGreaterThan(0);
  });

  it("computes an exact expected composite for a known partial-completeness item", () => {
    const engine = new KnowledgeQualityScoringEngine();
    // completeness = 2/4=50%, structural = 2/3 richness (67), length = 250/500=50
    const item = makeItem({
      requiredFieldsPresent: 2,
      requiredFieldsTotal: 4,
      hasSummary: true,
      hasExamples: true,
      hasOwner: false,
      contentLength: 250,
    });
    const score = engine.score(item);
    // completeness=50*0.5=25, structural=66.666...*0.3=20, length=50*0.2=10 -> 55
    expect(score.value).toBeCloseTo(55, 0);
  });

  it.each<[number, number, boolean, boolean, boolean, number, string]>([
    [4, 4, true, true, true, 500, "excellent"],
    [3, 4, true, true, false, 250, "fair"],
    [2, 4, true, false, false, 100, "poor"],
    [0, 4, false, false, false, 0, "poor"],
    [1, 4, false, true, false, 50, "poor"],
  ])(
    "bands item(fields=%p/%p, summary=%p, examples=%p, owner=%p, length=%p) as %s",
    (present, total, hasSummary, hasExamples, hasOwner, contentLength, expectedBand) => {
      const engine = new KnowledgeQualityScoringEngine();
      const score = engine.score(
        makeItem({
          requiredFieldsPresent: present,
          requiredFieldsTotal: total,
          hasSummary,
          hasExamples,
          hasOwner,
          contentLength,
        }),
      );
      expect(score.band).toBe(expectedBand);
    },
  );
});
