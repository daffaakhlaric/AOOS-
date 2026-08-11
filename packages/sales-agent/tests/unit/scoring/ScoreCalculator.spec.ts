import { describe, expect, it } from "vitest";

import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";
import { ScoreCalculator } from "../../../src/scoring/ScoreCalculator.js";

function totalOf(messageText: string): number {
  return ScoreCalculator.calculate(messageText).reduce((sum, delta) => sum + delta.amount, 0);
}

describe("ScoreCalculator", () => {
  it("budget mention → +25 (exact)", () => {
    expect(totalOf("budget 200 juta kak")).toBe(25);
  });

  it("unit mention → +25 (exact)", () => {
    expect(totalOf("ada xpander gak kak?")).toBe(25);
  });

  it("area mention → +25 (exact)", () => {
    expect(totalOf("cabangnya dimana ya kak")).toBe(25);
  });

  it("payment mention (kredit) → +25 (exact)", () => {
    expect(totalOf("mau kredit kak")).toBe(25);
  });

  it("payment mention (cash) → +25 (exact)", () => {
    expect(totalOf("cash aja kak")).toBe(25);
  });

  it("timeline → +10", () => {
    expect(totalOf("mau beli bulan ini kak")).toBe(10);
  });

  it("name → +10", () => {
    expect(totalOf("nama saya budi")).toBe(10);
  });

  it('"cuma tanya-tanya" → -20', () => {
    expect(totalOf("cuma tanya-tanya aja kak")).toBe(-20);
  });

  it("NO_REPLY's detect() never fires from message text (design resolution #3)", () => {
    const deltas = ScoreCalculator.calculate("apapun isinya, halo, xpander, kredit");
    expect(deltas.some((delta) => delta.criterion === "NO_REPLY")).toBe(false);
  });

  it("noReplyDelta() returns a -10 NO_REPLY delta for the timeout-driven path", () => {
    const delta = ScoreCalculator.noReplyDelta();
    expect(delta.criterion).toBe("NO_REPLY");
    expect(delta.amount).toBe(-10);
  });

  it("cumulative: budget+unit+area+payment via LeadScore = 100 (pinned)", () => {
    let score = LeadScore.zero();
    for (const delta of ScoreCalculator.calculate(
      "budget 200 juta, ada xpander, di cabang bintaro, mau kredit",
    )) {
      score = score.apply(delta.amount);
    }
    expect(score.toNumber()).toBe(100);
  });

  it("above (100) + hesitation (-20) via LeadScore = 80 (pinned)", () => {
    let score = LeadScore.zero();
    for (const delta of ScoreCalculator.calculate(
      "budget 200 juta, ada xpander, di cabang bintaro, mau kredit",
    )) {
      score = score.apply(delta.amount);
    }
    for (const delta of ScoreCalculator.calculate("cuma tanya-tanya aja")) {
      score = score.apply(delta.amount);
    }
    expect(score.toNumber()).toBe(80);
  });

  it("score never goes below 0, even after repeated negative deltas", () => {
    let score = LeadScore.zero();
    for (let i = 0; i < 5; i += 1) {
      for (const delta of ScoreCalculator.calculate("cuma tanya-tanya aja")) {
        score = score.apply(delta.amount);
      }
    }
    expect(score.toNumber()).toBe(0);
  });

  it("score never goes above 100, even after repeated positive deltas", () => {
    let score = LeadScore.zero();
    for (let i = 0; i < 5; i += 1) {
      for (const delta of ScoreCalculator.calculate(
        "budget 200 juta, ada xpander, di cabang bintaro, mau kredit",
      )) {
        score = score.apply(delta.amount);
      }
    }
    expect(score.toNumber()).toBe(100);
  });

  it("a message with no matching pattern produces no deltas", () => {
    expect(ScoreCalculator.calculate("zzz")).toHaveLength(0);
  });

  it("SCORING_RULES has exactly the 8 spec-defined criteria", () => {
    const allDeltas = ScoreCalculator.calculate(
      "budget 200 juta xpander cabang kredit bulan ini nama saya budi cuma tanya-tanya",
    );
    const criteria = new Set(allDeltas.map((delta) => delta.criterion));
    expect(criteria).toEqual(
      new Set(["BUDGET", "UNIT", "AREA", "PAYMENT", "TIMELINE", "NAME", "NOT_SERIOUS"]),
    );
  });
});
