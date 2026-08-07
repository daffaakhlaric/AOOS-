import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeFreshnessEngine } from "../../src/analysis/knowledge-freshness-engine.js";
import { KnowledgeReadinessEngine } from "../../src/intelligence/knowledge-readiness-engine.js";
import { KnowledgeQualityScoringEngine } from "../../src/scoring/knowledge-quality-scoring-engine.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../helpers/fixtures.js";

function makeEngine(now = 1000) {
  const config = makeConfig();
  const clock = makeClock(now);
  const quality = new KnowledgeQualityScoringEngine();
  const freshness = new KnowledgeFreshnessEngine(clock, config);
  return new KnowledgeReadinessEngine(quality, freshness, config);
}

describe("KnowledgeReadinessEngine", () => {
  beforeEach(() => resetFixtureState());

  it("scores a fully ready item at 100", () => {
    const engine = makeEngine();
    const item = makeItem({
      lastUpdatedAt: 1000,
      requiredFieldsPresent: 4,
      requiredFieldsTotal: 4,
      hasSummary: true,
      hasExamples: true,
      hasOwner: true,
      contentLength: 500,
    });
    expect(engine.scoreItem(item)).toBe(100);
  });

  it("counts ready items against the configured readinessMinScore", () => {
    const engine = makeEngine();
    const readyItem = makeItem({
      id: "a",
      lastUpdatedAt: 1000,
      requiredFieldsPresent: 4,
      requiredFieldsTotal: 4,
    });
    const unreadyItem = makeItem({
      id: "b",
      lastUpdatedAt: 1000,
      requiredFieldsPresent: 0,
      requiredFieldsTotal: 4,
      hasSummary: false,
      hasExamples: false,
      hasOwner: false,
      contentLength: 0,
    });
    const result = engine.scoreCorpus([readyItem, unreadyItem]);
    expect(result.totalItemCount).toBe(2);
    expect(result.readyItemCount).toBe(1);
  });

  it("returns a full-readiness result for an empty corpus", () => {
    const engine = makeEngine();
    const result = engine.scoreCorpus([]);
    expect(result.value).toBe(100);
    expect(result.totalItemCount).toBe(0);
  });

  it("treats an item with no required fields as fully complete", () => {
    const engine = makeEngine();
    const item = makeItem({
      lastUpdatedAt: 1000,
      requiredFieldsPresent: 0,
      requiredFieldsTotal: 0,
    });
    expect(engine.scoreItem(item)).toBeGreaterThan(0);
  });
});
