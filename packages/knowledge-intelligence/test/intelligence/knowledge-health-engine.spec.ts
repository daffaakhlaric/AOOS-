import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeFreshnessEngine } from "../../src/analysis/knowledge-freshness-engine.js";
import { KnowledgeRiskAnalyzer } from "../../src/analysis/knowledge-risk-analyzer.js";
import { KnowledgeHealthEngine } from "../../src/intelligence/knowledge-health-engine.js";
import { KnowledgeQualityScoringEngine } from "../../src/scoring/knowledge-quality-scoring-engine.js";
import { HealthStatus } from "../../src/types/health-status.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../helpers/fixtures.js";

function makeEngine(now = 1000, freshnessMaxAgeMs = 90 * 24 * 60 * 60 * 1000) {
  const config = makeConfig().with({ freshnessMaxAgeMs });
  const clock = makeClock(now);
  const quality = new KnowledgeQualityScoringEngine();
  const freshness = new KnowledgeFreshnessEngine(clock, config);
  const risk = new KnowledgeRiskAnalyzer(freshness, config);
  return new KnowledgeHealthEngine(quality, freshness, risk, config);
}

describe("KnowledgeHealthEngine", () => {
  beforeEach(() => resetFixtureState());

  it("scores a perfect item as fully Healthy", () => {
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
    const score = engine.score(item);
    expect(score.overall).toBe(100);
    expect(score.status).toBe(HealthStatus.Healthy);
  });

  it("scores a stale, incomplete, conflicting item as Critical", () => {
    const engine = makeEngine(50_000, 1000);
    const item = makeItem({
      lastUpdatedAt: 0,
      requiredFieldsPresent: 0,
      requiredFieldsTotal: 4,
      hasSummary: false,
      hasExamples: false,
      hasOwner: false,
      contentLength: 0,
      conflictsWith: ["x"],
    });
    const score = engine.score(item, 0);
    expect(score.status).toBe(HealthStatus.Critical);
  });

  it("defaults coverage to 100 when not supplied", () => {
    const engine = makeEngine();
    const item = makeItem({ lastUpdatedAt: 1000 });
    expect(engine.score(item).coverage).toBe(100);
  });

  it("computes scoreCorpus for multiple items", () => {
    const engine = makeEngine();
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    const results = engine.scoreCorpus(items);
    expect(results).toHaveLength(2);
    expect(results[0]!.itemId).toBe("a");
  });

  it("computes an average overall score across items", () => {
    const engine = makeEngine();
    const props = { lastUpdatedAt: 1000, contentLength: 500 };
    const items = [makeItem({ id: "a", ...props }), makeItem({ id: "b", ...props })];
    expect(engine.averageOverall(items)).toBe(100);
  });

  it("returns 100 average for an empty corpus", () => {
    const engine = makeEngine();
    expect(engine.averageOverall([])).toBe(100);
  });
});
