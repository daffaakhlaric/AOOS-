import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeFreshnessEngine } from "../../src/analysis/knowledge-freshness-engine.js";
import { KnowledgeRecommendationBuilder } from "../../src/recommendation/knowledge-recommendation-builder.js";
import { KnowledgeRecommendationEngine } from "../../src/recommendation/knowledge-recommendation-engine.js";
import { KnowledgeQualityScoringEngine } from "../../src/scoring/knowledge-quality-scoring-engine.js";
import { KnowledgeSimilarityEngine } from "../../src/similarity/knowledge-similarity-engine.js";
import { RecommendationType } from "../../src/types/recommendation-type.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../helpers/fixtures.js";

function makeEngine(freshnessMaxAgeMs = 90 * 24 * 60 * 60 * 1000, now = 1000) {
  const config = makeConfig().with({ freshnessMaxAgeMs });
  const clock = makeClock(now);
  const similarity = new KnowledgeSimilarityEngine(config);
  const freshness = new KnowledgeFreshnessEngine(clock, config);
  const quality = new KnowledgeQualityScoringEngine();
  const builder = new KnowledgeRecommendationBuilder(clock);
  return new KnowledgeRecommendationEngine(similarity, freshness, quality, builder);
}

describe("KnowledgeRecommendationEngine", () => {
  beforeEach(() => resetFixtureState());

  it("recommends Merge for a duplicate pair", () => {
    const engine = makeEngine();
    const a = makeItem({ id: "a", tags: ["x", "y"] });
    const b = makeItem({ id: "b", tags: ["x", "y"] });
    const recs = engine.generate([a, b]);
    expect(recs.some((r) => r.type === RecommendationType.Merge)).toBe(true);
  });

  it("recommends Consolidation for a near-duplicate pair", () => {
    const engine = makeEngine();
    const a = makeItem({ id: "a", tags: ["p", "q", "r"] });
    const b = makeItem({ id: "b", tags: ["p", "q", "r", "s"] });
    const recs = engine.generate([a, b]);
    expect(recs.some((r) => r.type === RecommendationType.Consolidation)).toBe(true);
  });

  it("recommends Archive for a stale, low-usage item", () => {
    const engine = makeEngine(1000, 100_000);
    const item = makeItem({ lastUpdatedAt: 0, viewCount: 1 });
    const recs = engine.generate([item]);
    expect(recs.some((r) => r.type === RecommendationType.Archive)).toBe(true);
  });

  it("recommends Update for a stale, actively-used item", () => {
    const engine = makeEngine(1000, 100_000);
    const item = makeItem({ lastUpdatedAt: 0, viewCount: 50 });
    const recs = engine.generate([item]);
    expect(recs.some((r) => r.type === RecommendationType.Update)).toBe(true);
  });

  it("recommends Split for very long content", () => {
    const engine = makeEngine();
    const item = makeItem({ lastUpdatedAt: 1000, contentLength: 6000 });
    const recs = engine.generate([item]);
    expect(recs.some((r) => r.type === RecommendationType.Split)).toBe(true);
  });

  it("recommends Improvement for a low-quality item", () => {
    const engine = makeEngine();
    const item = makeItem({
      lastUpdatedAt: 1000,
      hasSummary: false,
      hasExamples: false,
      hasOwner: false,
      requiredFieldsPresent: 0,
      requiredFieldsTotal: 4,
      contentLength: 0,
    });
    const recs = engine.generate([item]);
    expect(recs.some((r) => r.type === RecommendationType.Improvement)).toBe(true);
  });

  it("generates no recommendations for a healthy, fresh, well-formed item", () => {
    const engine = makeEngine();
    const item = makeItem({
      lastUpdatedAt: 1000,
      hasSummary: true,
      hasExamples: true,
      hasOwner: true,
      requiredFieldsPresent: 4,
      requiredFieldsTotal: 4,
      contentLength: 500,
      viewCount: 100,
    });
    expect(engine.generate([item])).toHaveLength(0);
  });

  it("returns no recommendations for an empty corpus", () => {
    const engine = makeEngine();
    expect(engine.generate([])).toHaveLength(0);
  });

  it.each<[number, RecommendationType]>([
    [0, RecommendationType.Archive],
    [1, RecommendationType.Archive],
    [2, RecommendationType.Archive],
    [3, RecommendationType.Update],
    [100, RecommendationType.Update],
  ])("viewCount=%p -> %s for a stale item", (viewCount, expected) => {
    const engine = makeEngine(1000, 100_000);
    const item = makeItem({ lastUpdatedAt: 0, viewCount });
    const recs = engine.generate([item]);
    expect(recs.some((r) => r.type === expected)).toBe(true);
  });
});
