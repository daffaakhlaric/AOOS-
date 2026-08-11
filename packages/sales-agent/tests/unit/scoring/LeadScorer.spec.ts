import { describe, expect, it } from "vitest";

import { LeadScorer } from "../../../src/scoring/LeadScorer.js";

describe("LeadScorer", () => {
  it("score() delegates to ScoreCalculator and returns matching deltas", () => {
    const scorer = new LeadScorer();
    const deltas = scorer.score("budget 200 juta kak");
    expect(deltas.some((delta) => delta.criterion === "BUDGET" && delta.amount === 25)).toBe(true);
  });

  it("score() returns an empty array for a message that matches nothing", () => {
    const scorer = new LeadScorer();
    expect(scorer.score("zzz")).toEqual([]);
  });
});
