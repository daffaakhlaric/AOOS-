import { describe, expect, it } from "vitest";

import { PropertyLeadScorer } from "../../../src/scoring/PropertyLeadScorer.js";

describe("PropertyLeadScorer", () => {
  it("score() delegates to PropertyScoreCalculator and returns matching deltas", () => {
    const scorer = new PropertyLeadScorer();
    const deltas = scorer.score("budget 1.5 miliar kak");
    expect(deltas.some((delta) => delta.criterion === "BUDGET" && delta.amount === 20)).toBe(true);
  });

  it("score() returns an empty array for a message that matches nothing", () => {
    const scorer = new PropertyLeadScorer();
    expect(scorer.score("zzz")).toEqual([]);
  });
});
