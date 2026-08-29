import { describe, expect, it } from "vitest";

import { ResponseLengthScorer } from "../../../src/scorers/ResponseLengthScorer.js";
import {
  CLARA,
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
      avgClaraResponseLength: 130,
      maxClaraResponseLength: 140,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "AVG_VERY_CONCISE")).toBe(4);
  });

  it("avg 180 chars -> AVG_CONCISE +3", () => {
    const sim = makeSimulationResult({
      avgClaraResponseLength: 180,
      maxClaraResponseLength: 190,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "AVG_CONCISE")).toBe(3);
  });

  it("avg 220 chars -> AVG_ACCEPTABLE +2", () => {
    const sim = makeSimulationResult({
      avgClaraResponseLength: 220,
      maxClaraResponseLength: 230,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "AVG_ACCEPTABLE")).toBe(2);
  });

  it("avg 260 chars -> AVG_TOO_LONG +0", () => {
    const sim = makeSimulationResult({
      avgClaraResponseLength: 260,
      maxClaraResponseLength: 270,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "AVG_TOO_LONG")).toBe(0);
  });

  it("max > 300 chars -> MAX_OVER_300 -2", () => {
    const sim = makeSimulationResult({
      avgClaraResponseLength: 150,
      maxClaraResponseLength: 310,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MAX_OVER_300")).toBe(-2);
  });

  it("max > 400 chars -> MAX_OVER_400 -3 (on top of MAX_OVER_300)", () => {
    const sim = makeSimulationResult({
      avgClaraResponseLength: 150,
      maxClaraResponseLength: 410,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MAX_OVER_300")).toBe(-2);
    expect(ruleFrom(result.appliedRules, "MAX_OVER_400")).toBe(-3);
  });

  it("max within bounds -> neither MAX_OVER rule applies", () => {
    const sim = makeSimulationResult({
      avgClaraResponseLength: 100,
      maxClaraResponseLength: 120,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MAX_OVER_300")).toBe(0);
    expect(ruleFrom(result.appliedRules, "MAX_OVER_400")).toBe(0);
  });

  it("more than 2 messages over 250 chars -> MORE_THAN_TWO_LONG_MESSAGES -1", () => {
    const long = "x".repeat(260);
    const sim = makeSimulationResult({
      avgClaraResponseLength: 150,
      maxClaraResponseLength: 260,
      messages: [
        makeMessage(1, CLARA, long),
        makeMessage(2, CLARA, long),
        makeMessage(3, CLARA, long),
      ],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MORE_THAN_TWO_LONG_MESSAGES")).toBe(-1);
  });

  it("exactly 2 messages over 250 chars -> MORE_THAN_TWO_LONG_MESSAGES not applied", () => {
    const long = "x".repeat(260);
    const sim = makeSimulationResult({
      avgClaraResponseLength: 150,
      maxClaraResponseLength: 260,
      messages: [makeMessage(1, CLARA, long), makeMessage(2, CLARA, long)],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MORE_THAN_TWO_LONG_MESSAGES")).toBe(0);
  });

  it("score is clamped 0-10", () => {
    const sim = makeSimulationResult({
      avgClaraResponseLength: 500,
      maxClaraResponseLength: 600,
      messages: [],
    });
    const result = scorer.score(sim);
    expect(result.score.value).toBeLessThanOrEqual(10);
    expect(result.score.value).toBeGreaterThanOrEqual(0);
  });
});
