import { describe, expect, it } from "vitest";

import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";
import {
  classifyTemperature,
  LeadTemperature,
} from "../../../src/domain/value-objects/LeadTemperature.js";
import {
  PROPERTY_HOT_THRESHOLD,
  PROPERTY_SCORING_RULES,
  PROPERTY_WARM_THRESHOLD,
  PropertyScoreCalculator,
} from "../../../src/scoring/PropertyScoreCalculator.js";

function totalOf(messageText: string): number {
  return PropertyScoreCalculator.calculate(messageText).reduce(
    (sum, delta) => sum + delta.amount,
    0,
  );
}

describe("PropertyScoreCalculator", () => {
  it("budget mention → +20 (exact)", () => {
    expect(totalOf("budget 2 miliar kak")).toBe(20);
  });

  it("property type mention → +15 (exact)", () => {
    expect(totalOf("mau cari rumah kak")).toBe(15);
  });

  it("area mention → +20 (exact)", () => {
    expect(totalOf("mau di area bintaro kak")).toBe(20);
  });

  it("payment mention (KPR) → +15 (exact)", () => {
    expect(totalOf("rencana KPR kak")).toBe(15);
  });

  it("payment mention (cash) → +15 (exact)", () => {
    expect(totalOf("cash aja kak")).toBe(15);
  });

  it("timeline mention → +20 (exact)", () => {
    expect(totalOf("mau beli bulan ini kak")).toBe(20);
  });

  it("bedrooms mention → +10 (exact)", () => {
    expect(totalOf("butuh 3 kamar kak")).toBe(10);
  });

  it("a message with no matching pattern produces no deltas", () => {
    expect(PropertyScoreCalculator.calculate("zzz")).toHaveLength(0);
  });

  it("PROPERTY_SCORING_RULES has exactly the 6 spec-defined dimensions summing to 100", () => {
    expect(PROPERTY_SCORING_RULES).toHaveLength(6);
    const total = PROPERTY_SCORING_RULES.reduce((sum, rule) => sum + rule.score, 0);
    expect(total).toBe(100);
    const criteria = new Set(PROPERTY_SCORING_RULES.map((rule) => rule.criterion));
    expect(criteria).toEqual(
      new Set(["BUDGET", "PROPERTY_TYPE", "AREA", "PAYMENT", "TIMELINE", "BEDROOMS"]),
    );
  });

  it("carries the exact spec-pinned Indonesian question copy per dimension", () => {
    const byCriterion = new Map(PROPERTY_SCORING_RULES.map((rule) => [rule.criterion, rule]));
    expect(byCriterion.get("BUDGET")?.question).toBe(
      "Budget propertinya berapa kak? Beli cash atau KPR?",
    );
    expect(byCriterion.get("PROPERTY_TYPE")?.question).toBe(
      "Mau cari rumah, apartemen, atau ruko kak?",
    );
    expect(byCriterion.get("AREA")?.question).toBe("Mau di area mana kak?");
    expect(byCriterion.get("PAYMENT")?.question).toBe("Rencana KPR atau cash kak?");
    expect(byCriterion.get("TIMELINE")?.question).toBe("Rencana beli kapan kak?");
    expect(byCriterion.get("BEDROOMS")?.question).toBe("Butuh berapa kamar tidur kak?");
  });

  it("cumulative: every dimension via LeadScore = 100 (pinned)", () => {
    let score = LeadScore.zero();
    for (const delta of PropertyScoreCalculator.calculate(
      "budget 2 miliar, mau cari rumah, area bintaro, KPR, bulan ini, butuh 3 kamar",
    )) {
      score = score.apply(delta.amount);
    }
    expect(score.toNumber()).toBe(100);
  });

  it("classifyTemperature with spec Part 6's thresholds (HOT>=65, WARM 30-64, COLD<30)", () => {
    expect(PROPERTY_WARM_THRESHOLD).toBe(30);
    expect(PROPERTY_HOT_THRESHOLD).toBe(65);
    expect(classifyTemperature(29, PROPERTY_WARM_THRESHOLD, PROPERTY_HOT_THRESHOLD)).toBe(
      LeadTemperature.COLD,
    );
    expect(classifyTemperature(30, PROPERTY_WARM_THRESHOLD, PROPERTY_HOT_THRESHOLD)).toBe(
      LeadTemperature.WARM,
    );
    expect(classifyTemperature(64, PROPERTY_WARM_THRESHOLD, PROPERTY_HOT_THRESHOLD)).toBe(
      LeadTemperature.WARM,
    );
    expect(classifyTemperature(65, PROPERTY_WARM_THRESHOLD, PROPERTY_HOT_THRESHOLD)).toBe(
      LeadTemperature.HOT,
    );
  });
});
