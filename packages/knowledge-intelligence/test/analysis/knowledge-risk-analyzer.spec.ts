import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeFreshnessEngine } from "../../src/analysis/knowledge-freshness-engine.js";
import { KnowledgeRiskAnalyzer } from "../../src/analysis/knowledge-risk-analyzer.js";
import { RiskLevel } from "../../src/types/risk-level.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../helpers/fixtures.js";

describe("KnowledgeRiskAnalyzer", () => {
  beforeEach(() => resetFixtureState());

  it("assesses a fresh, complete, conflict-free item as Low risk", () => {
    const config = makeConfig();
    const clock = makeClock(1000);
    const freshness = new KnowledgeFreshnessEngine(clock, config);
    const analyzer = new KnowledgeRiskAnalyzer(freshness, config);
    const item = makeItem({
      lastUpdatedAt: 1000,
      requiredFieldsPresent: 4,
      requiredFieldsTotal: 4,
    });
    const assessment = analyzer.assess(item);
    expect(assessment.value).toBe(0);
    expect(assessment.level).toBe(RiskLevel.Low);
  });

  it("assesses a stale, incomplete, conflicting item as Critical risk", () => {
    const config = makeConfig().with({ freshnessMaxAgeMs: 1000 });
    const clock = makeClock(50_000);
    const freshness = new KnowledgeFreshnessEngine(clock, config);
    const analyzer = new KnowledgeRiskAnalyzer(freshness, config);
    const item = makeItem({
      lastUpdatedAt: 0,
      requiredFieldsPresent: 0,
      requiredFieldsTotal: 4,
      conflictsWith: ["other-item"],
    });
    const assessment = analyzer.assess(item);
    expect(assessment.value).toBe(100);
    expect(assessment.level).toBe(RiskLevel.Critical);
  });

  it("scores conflict presence as a full-weight risk contributor", () => {
    const config = makeConfig();
    const clock = makeClock(1000);
    const freshness = new KnowledgeFreshnessEngine(clock, config);
    const analyzer = new KnowledgeRiskAnalyzer(freshness, config);
    const item = makeItem({
      lastUpdatedAt: 1000,
      requiredFieldsPresent: 4,
      requiredFieldsTotal: 4,
      conflictsWith: ["x"],
    });
    // staleness=0*0.4 + conflict=100*0.35 + incompleteness=0*0.25 = 35
    expect(analyzer.assess(item).value).toBeCloseTo(35, 5);
  });

  it.each<[number, boolean, number, number, number]>([
    [0, false, 4, 4, 0],
    [1000, true, 0, 4, 100],
    [500, false, 4, 4, 20],
    [0, true, 4, 4, 35],
    [0, false, 2, 4, 12.5],
  ])(
    "age=%p conflict=%p present=%p/%p -> risk=%p",
    (age, hasConflict, present, total, expected) => {
      const config = makeConfig().with({ freshnessMaxAgeMs: 1000 });
      const clock = makeClock(age);
      const freshness = new KnowledgeFreshnessEngine(clock, config);
      const analyzer = new KnowledgeRiskAnalyzer(freshness, config);
      const item = makeItem({
        lastUpdatedAt: 0,
        requiredFieldsPresent: present,
        requiredFieldsTotal: total,
        conflictsWith: hasConflict ? ["x"] : undefined,
      });
      expect(analyzer.assess(item).value).toBeCloseTo(expected, 10);
    },
  );

  it("treats an item with no required fields as fully complete for risk purposes", () => {
    const config = makeConfig();
    const clock = makeClock(1000);
    const freshness = new KnowledgeFreshnessEngine(clock, config);
    const analyzer = new KnowledgeRiskAnalyzer(freshness, config);
    const item = makeItem({
      lastUpdatedAt: 1000,
      requiredFieldsPresent: 0,
      requiredFieldsTotal: 0,
    });
    expect(analyzer.assess(item).value).toBe(0);
  });
});
