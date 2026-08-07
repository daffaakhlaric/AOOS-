import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeIntelligenceEngine } from "../../src/intelligence/knowledge-intelligence-engine.js";
import { HealthStatus } from "../../src/types/health-status.js";
import { resetFixtureState, makeClock, makeItem } from "../helpers/fixtures.js";

describe("KnowledgeIntelligenceEngine — full pipeline scenarios", () => {
  beforeEach(() => resetFixtureState());

  it.each<[number, string]>([
    [500, "excellent"],
    [400, "good"],
    [300, "fair"],
    [50, "poor"],
  ])(
    "a corpus of well-formed items with contentLength=%p yields quality band %s",
    (contentLength) => {
      const clock = makeClock(1000);
      const engine = new KnowledgeIntelligenceEngine({ clock });
      const items = [makeItem({ id: "a", lastUpdatedAt: 1000, contentLength })];
      const context = engine.runIntelligence({ items });
      expect(context.qualityScores?.get("a")).toBeDefined();
    },
  );

  it.each<[number]>([[1], [2], [3], [5], [10]])(
    "runs cleanly for a corpus of %d items with no duplicates",
    (count) => {
      const clock = makeClock(1000);
      const engine = new KnowledgeIntelligenceEngine({ clock });
      const items = Array.from({ length: count }, (_, i) =>
        makeItem({
          id: `item-${i}`,
          tags: [`unique-${i}`],
          lastUpdatedAt: 1000,
          contentLength: 500,
        }),
      );
      const context = engine.runIntelligence({ items });
      expect(context.duplicates).toHaveLength(0);
      expect(context.statistics?.itemsAnalyzed).toBe(count);
    },
  );

  it("detects a chain of duplicates across a larger corpus", () => {
    const clock = makeClock(1000);
    const engine = new KnowledgeIntelligenceEngine({ clock });
    const items = [
      makeItem({ id: "a", tags: ["x", "y"], lastUpdatedAt: 1000 }),
      makeItem({ id: "b", tags: ["x", "y"], lastUpdatedAt: 1000 }),
      makeItem({ id: "c", tags: ["x", "y"], lastUpdatedAt: 1000 }),
      makeItem({ id: "d", tags: ["m", "n"], lastUpdatedAt: 1000 }),
    ];
    const context = engine.runIntelligence({ items });
    // a/b, a/c, b/c are all duplicate pairs -> 3 pairs
    expect(context.duplicates).toHaveLength(3);
  });

  it("produces a Critical health status for a corpus of entirely stale, incomplete items", () => {
    // Far beyond the default 90-day freshnessMaxAgeMs so freshness bottoms out at 0.
    const clock = makeClock(1_000_000_000_000);
    const engine = new KnowledgeIntelligenceEngine({ clock });
    const items = Array.from({ length: 3 }, (_, i) =>
      makeItem({
        id: `item-${i}`,
        lastUpdatedAt: 0,
        requiredFieldsPresent: 0,
        requiredFieldsTotal: 4,
        hasSummary: false,
        hasExamples: false,
        hasOwner: false,
        contentLength: 0,
      }),
    );
    const context = engine.runIntelligence({ items });
    expect(context.healthReport?.overallScore.status).toBe(HealthStatus.Critical);
  });

  it("produces a Healthy status for a corpus of entirely fresh, complete items", () => {
    const clock = makeClock(1000);
    const engine = new KnowledgeIntelligenceEngine({ clock });
    const items = Array.from({ length: 3 }, (_, i) =>
      makeItem({
        id: `item-${i}`,
        tags: [`unique-${i}`],
        lastUpdatedAt: 1000,
        requiredFieldsPresent: 4,
        requiredFieldsTotal: 4,
        hasSummary: true,
        hasExamples: true,
        hasOwner: true,
        contentLength: 500,
      }),
    );
    const context = engine.runIntelligence({ items });
    expect(context.healthReport?.overallScore.status).toBe(HealthStatus.Healthy);
  });

  it("generates recommendations covering multiple types for a mixed corpus", () => {
    const clock = makeClock(100_000);
    const engine = new KnowledgeIntelligenceEngine({ clock });
    const items = [
      makeItem({ id: "dup-a", tags: ["x", "y"], lastUpdatedAt: 100_000, contentLength: 500 }),
      makeItem({ id: "dup-b", tags: ["x", "y"], lastUpdatedAt: 100_000, contentLength: 500 }),
      makeItem({ id: "huge", tags: ["z"], lastUpdatedAt: 100_000, contentLength: 6000 }),
      makeItem({
        id: "poor",
        tags: ["w"],
        lastUpdatedAt: 100_000,
        contentLength: 0,
        hasSummary: false,
        hasExamples: false,
        hasOwner: false,
        requiredFieldsPresent: 0,
        requiredFieldsTotal: 4,
      }),
    ];
    const context = engine.runIntelligence({ items });
    const types = new Set(context.recommendations?.map((r) => r.type));
    expect(types.size).toBeGreaterThan(1);
  });

  it("detects gaps and orphans together in a single run", () => {
    const clock = makeClock(1000);
    const engine = new KnowledgeIntelligenceEngine({ clock });
    const items = [
      makeItem({ id: "a", lastUpdatedAt: 1000 }),
      makeItem({ id: "b", lastUpdatedAt: 1000 }),
    ];
    const context = engine.runIntelligence({
      items,
      taxonomy: [
        { topic: "covered", covered: true, itemCount: 2 },
        { topic: "missing-1", covered: false, itemCount: 0 },
        { topic: "missing-2", covered: false, itemCount: 0 },
      ],
      adjacency: {},
    });
    expect(context.gapReport?.gaps).toHaveLength(2);
    expect(context.gapReport?.orphans).toHaveLength(2);
  });

  it("is deterministic: two runs with the same inputs and clock produce the same scores", () => {
    const items = [makeItem({ id: "a", lastUpdatedAt: 1000, contentLength: 500 })];
    const engineA = new KnowledgeIntelligenceEngine({ clock: makeClock(1000) });
    const engineB = new KnowledgeIntelligenceEngine({ clock: makeClock(1000) });
    const contextA = engineA.runIntelligence({ items });
    const contextB = engineB.runIntelligence({ items });
    expect(contextA.healthReport?.overallScore.overall).toBe(
      contextB.healthReport?.overallScore.overall,
    );
  });
});
