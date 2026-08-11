import { describe, expect, it } from "vitest";

import { ResponseLengthScorer } from "../../../src/scorers/ResponseLengthScorer.js";
import {
  JESSY,
  makeMessage,
  makeSimulationResult,
} from "../../fixtures/simulationResultFixtures.js";

function ruleFrom(
  appliedRules: ReadonlyArray<{ rule: string; points: number }>,
  rule: string,
): number {
  return appliedRules.find((r) => r.rule === rule)?.points ?? NaN;
}

const scorer = new ResponseLengthScorer();

describe("ResponseLengthScorer", () => {
  it("avg 130 chars -> AVG_VERY_CONCISE +4", () => {
    const sim = makeSimulationResult({
      avgJessyResponseLength: 130,
      maxJessyResponseLength: 140,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "AVG_VERY_CONCISE")).toBe(4);
  });

  it("avg 180 chars -> AVG_CONCISE +3", () => {
    const sim = makeSimulationResult({
      avgJessyResponseLength: 180,
      maxJessyResponseLength: 190,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "AVG_CONCISE")).toBe(3);
  });

  it("avg 220 chars -> AVG_ACCEPTABLE +2", () => {
    const sim = makeSimulationResult({
      avgJessyResponseLength: 220,
      maxJessyResponseLength: 230,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "AVG_ACCEPTABLE")).toBe(2);
  });

  it("avg 260 chars -> AVG_TOO_LONG +0", () => {
    const sim = makeSimulationResult({
      avgJessyResponseLength: 260,
      maxJessyResponseLength: 270,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "AVG_TOO_LONG")).toBe(0);
  });

  it("max > 300 chars -> MAX_OVER_300 -2", () => {
    const sim = makeSimulationResult({
      avgJessyResponseLength: 150,
      maxJessyResponseLength: 310,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MAX_OVER_300")).toBe(-2);
  });

  it("max > 400 chars -> MAX_OVER_400 -3 (on top of MAX_OVER_300)", () => {
    const sim = makeSimulationResult({
      avgJessyResponseLength: 150,
      maxJessyResponseLength: 410,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MAX_OVER_300")).toBe(-2);
    expect(ruleFrom(result.appliedRules, "MAX_OVER_400")).toBe(-3);
  });

  it("max within bounds -> neither MAX_OVER rule applies", () => {
    const sim = makeSimulationResult({
      avgJessyResponseLength: 100,
      maxJessyResponseLength: 120,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MAX_OVER_300")).toBe(0);
    expect(ruleFrom(result.appliedRules, "MAX_OVER_400")).toBe(0);
  });

  it("more than 2 messages over 250 chars -> MORE_THAN_TWO_LONG_MESSAGES -1", () => {
    const long = "x".repeat(260);
    const sim = makeSimulationResult({
      avgJessyResponseLength: 150,
      maxJessyResponseLength: 260,
      messages: [
        makeMessage(1, JESSY, long),
        makeMessage(2, JESSY, long),
        makeMessage(3, JESSY, long),
      ],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MORE_THAN_TWO_LONG_MESSAGES")).toBe(-1);
  });

  it("exactly 2 messages over 250 chars -> MORE_THAN_TWO_LONG_MESSAGES not applied", () => {
    const long = "x".repeat(260);
    const sim = makeSimulationResult({
      avgJessyResponseLength: 150,
      maxJessyResponseLength: 260,
      messages: [makeMessage(1, JESSY, long), makeMessage(2, JESSY, long)],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MORE_THAN_TWO_LONG_MESSAGES")).toBe(0);
  });

  it("score is clamped 0-10", () => {
    const sim = makeSimulationResult({
      avgJessyResponseLength: 500,
      maxJessyResponseLength: 600,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(result.score.value).toBeLessThanOrEqual(10);
    expect(result.score.value).toBeGreaterThanOrEqual(0);
  });
});
