import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeInsightEngine } from "../../src/intelligence/knowledge-insight-engine.js";
import { KnowledgeInsightBuilder } from "../../src/recommendation/knowledge-insight-builder.js";
import { resetFixtureState, makeClock } from "../helpers/fixtures.js";

function baseData() {
  return {
    totalItems: 10,
    duplicatePairCount: 0,
    nearDuplicatePairCount: 0,
    gapCount: 0,
    orphanCount: 0,
    staleItemCount: 0,
    averageHealthScore: 90,
    duplicateItemIds: [],
    orphanItemIds: [],
  };
}

describe("KnowledgeInsightEngine", () => {
  beforeEach(() => resetFixtureState());

  it("always emits an average-health insight", () => {
    const engine = new KnowledgeInsightEngine(new KnowledgeInsightBuilder(makeClock(0)));
    const insights = engine.generate(baseData());
    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe("info");
  });

  it("emits a critical severity when average health is low", () => {
    const engine = new KnowledgeInsightEngine(new KnowledgeInsightBuilder(makeClock(0)));
    const insights = engine.generate({ ...baseData(), averageHealthScore: 30 });
    expect(insights[0]!.severity).toBe("critical");
  });

  it("emits a warning severity for mid-range health", () => {
    const engine = new KnowledgeInsightEngine(new KnowledgeInsightBuilder(makeClock(0)));
    const insights = engine.generate({ ...baseData(), averageHealthScore: 60 });
    expect(insights[0]!.severity).toBe("warning");
  });

  it("emits a duplicate insight with related item ids when duplicates exist", () => {
    const engine = new KnowledgeInsightEngine(new KnowledgeInsightBuilder(makeClock(0)));
    const insights = engine.generate({
      ...baseData(),
      duplicatePairCount: 1,
      duplicateItemIds: ["a", "b"],
    });
    const dupInsight = insights.find((i) => i.title.includes("duplicate pair"));
    expect(dupInsight?.severity).toBe("critical");
    expect(dupInsight?.relatedItemIds).toEqual(["a", "b"]);
  });

  it("emits a near-duplicate insight when near-duplicates exist", () => {
    const engine = new KnowledgeInsightEngine(new KnowledgeInsightBuilder(makeClock(0)));
    const insights = engine.generate({ ...baseData(), nearDuplicatePairCount: 2 });
    expect(insights.some((i) => i.title.includes("near-duplicate"))).toBe(true);
  });

  it("emits a gap insight when gaps exist", () => {
    const engine = new KnowledgeInsightEngine(new KnowledgeInsightBuilder(makeClock(0)));
    const insights = engine.generate({ ...baseData(), gapCount: 3 });
    expect(insights.some((i) => i.title.includes("coverage gap"))).toBe(true);
  });

  it("emits an orphan insight when orphans exist", () => {
    const engine = new KnowledgeInsightEngine(new KnowledgeInsightBuilder(makeClock(0)));
    const insights = engine.generate({ ...baseData(), orphanCount: 1, orphanItemIds: ["z"] });
    const orphanInsight = insights.find((i) => i.title.includes("orphaned"));
    expect(orphanInsight?.relatedItemIds).toEqual(["z"]);
  });

  it("emits a staleness insight when stale items exist", () => {
    const engine = new KnowledgeInsightEngine(new KnowledgeInsightBuilder(makeClock(0)));
    const insights = engine.generate({ ...baseData(), staleItemCount: 5 });
    expect(insights.some((i) => i.title.includes("stale"))).toBe(true);
  });

  it("emits all insight kinds together when every condition is met", () => {
    const engine = new KnowledgeInsightEngine(new KnowledgeInsightBuilder(makeClock(0)));
    const insights = engine.generate({
      totalItems: 5,
      duplicatePairCount: 1,
      nearDuplicatePairCount: 1,
      gapCount: 1,
      orphanCount: 1,
      staleItemCount: 1,
      averageHealthScore: 40,
      duplicateItemIds: ["a"],
      orphanItemIds: ["b"],
    });
    expect(insights).toHaveLength(6);
  });
});
