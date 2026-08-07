import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeFreshnessEngine } from "../../src/analysis/knowledge-freshness-engine.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../helpers/fixtures.js";

describe("KnowledgeFreshnessEngine", () => {
  beforeEach(() => resetFixtureState());

  it("scores a just-updated item as fully fresh", () => {
    const clock = makeClock(1000);
    const engine = new KnowledgeFreshnessEngine(clock, makeConfig());
    const score = engine.score(makeItem({ lastUpdatedAt: 1000 }));
    expect(score.value).toBe(100);
    expect(score.band).toBe("fresh");
  });

  it("computes an exact linear-decay score for a known age", () => {
    const config = makeConfig().with({ freshnessMaxAgeMs: 1000 });
    const clock = makeClock(500);
    const engine = new KnowledgeFreshnessEngine(clock, config);
    // age=500, maxAge=1000 -> score = 100*(1-0.5) = 50
    const score = engine.score(makeItem({ lastUpdatedAt: 0 }));
    expect(score.value).toBe(50);
  });

  it("clamps the score to 0 for an item older than maxAge", () => {
    const config = makeConfig().with({ freshnessMaxAgeMs: 1000 });
    const clock = makeClock(5000);
    const engine = new KnowledgeFreshnessEngine(clock, config);
    const score = engine.score(makeItem({ lastUpdatedAt: 0 }));
    expect(score.value).toBe(0);
    expect(score.band).toBe("stale");
  });

  it("identifies staleness via isStale()", () => {
    const config = makeConfig().with({ freshnessMaxAgeMs: 1000 });
    const clock = makeClock(2000);
    const engine = new KnowledgeFreshnessEngine(clock, config);
    expect(engine.isStale(makeItem({ lastUpdatedAt: 0 }))).toBe(true);
    expect(engine.isStale(makeItem({ lastUpdatedAt: 1500 }))).toBe(false);
  });

  it("reports ageMs relative to the injected clock", () => {
    const clock = makeClock(5000);
    const engine = new KnowledgeFreshnessEngine(clock, makeConfig());
    expect(engine.ageMs(makeItem({ lastUpdatedAt: 2000 }))).toBe(3000);
  });

  it("never returns a negative age even if lastUpdatedAt is in the future", () => {
    const clock = makeClock(0);
    const engine = new KnowledgeFreshnessEngine(clock, makeConfig());
    expect(engine.ageMs(makeItem({ lastUpdatedAt: 100 }))).toBe(0);
  });

  it.each<[number, number, number]>([
    [0, 1000, 100],
    [100, 1000, 90],
    [250, 1000, 75],
    [500, 1000, 50],
    [750, 1000, 25],
    [900, 1000, 10],
    [1000, 1000, 0],
    [1500, 1000, 0],
  ])("linear decay: age=%p, maxAge=%p -> score=%p", (age, maxAge, expectedScore) => {
    const config = makeConfig().with({ freshnessMaxAgeMs: maxAge });
    const clock = makeClock(age);
    const engine = new KnowledgeFreshnessEngine(clock, config);
    const score = engine.score(makeItem({ lastUpdatedAt: 0 }));
    expect(score.value).toBeCloseTo(expectedScore, 10);
  });
});
