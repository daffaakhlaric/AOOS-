import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeFreshnessEngine } from "../../src/analysis/knowledge-freshness-engine.js";
import { KnowledgeRiskAnalyzer } from "../../src/analysis/knowledge-risk-analyzer.js";
import { KnowledgePriorityEngine } from "../../src/recommendation/knowledge-priority-engine.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../helpers/fixtures.js";

describe("KnowledgePriorityEngine", () => {
  beforeEach(() => resetFixtureState());

  it("scores a fresh, low-risk item as low priority", () => {
    const config = makeConfig();
    const clock = makeClock(1000);
    const freshness = new KnowledgeFreshnessEngine(clock, config);
    const risk = new KnowledgeRiskAnalyzer(freshness, config);
    const engine = new KnowledgePriorityEngine(risk, freshness);
    const item = makeItem({
      lastUpdatedAt: 1000,
      requiredFieldsPresent: 4,
      requiredFieldsTotal: 4,
    });
    const score = engine.score(item);
    expect(score.value).toBe(0);
    expect(score.band).toBe("low");
  });

  it("scores a stale, high-risk item as urgent priority", () => {
    const config = makeConfig().with({ freshnessMaxAgeMs: 1000 });
    const clock = makeClock(50_000);
    const freshness = new KnowledgeFreshnessEngine(clock, config);
    const risk = new KnowledgeRiskAnalyzer(freshness, config);
    const engine = new KnowledgePriorityEngine(risk, freshness);
    const item = makeItem({
      lastUpdatedAt: 0,
      requiredFieldsPresent: 0,
      requiredFieldsTotal: 4,
      conflictsWith: ["other"],
    });
    const score = engine.score(item);
    expect(score.value).toBe(100);
    expect(score.band).toBe("urgent");
  });
});
