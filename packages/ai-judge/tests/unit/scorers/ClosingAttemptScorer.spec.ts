import { ConversationStage } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { ClosingAttemptScorer } from "../../../src/scorers/ClosingAttemptScorer.js";
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

const scorer = new ClosingAttemptScorer();

describe("ClosingAttemptScorer", () => {
  it("CLOSING stage reached at/before turn 10, mentions test drive -> high score", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(6, JESSY, "Kapan kak bisa jadwalkan test drive?")],
      stageTransitions: [
        { turn: 6, from: ConversationStage.PRICE_INFO, to: ConversationStage.CLOSING },
      ],
      finalScore: 70,
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "CLOSING_ATTEMPTED")).toBe(4);
    expect(ruleFrom(result.appliedRules, "MENTIONS_CLOSING_INTENT")).toBe(3);
    expect(ruleFrom(result.appliedRules, "CLOSING_NOT_TOO_LATE")).toBe(2);
    expect(result.score.value).toBeGreaterThanOrEqual(8);
  });

  it("closing reached but the message doesn't mention test drive/survey/jadwal -> MENTIONS_CLOSING_INTENT not awarded", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(6, JESSY, "Gimana kak, cocok gak?")],
      stageTransitions: [
        { turn: 6, from: ConversationStage.PRICE_INFO, to: ConversationStage.CLOSING },
      ],
      finalScore: 70,
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MENTIONS_CLOSING_INTENT")).toBe(0);
  });

  it("closing after turn 10 -> CLOSING_NOT_TOO_LATE not awarded", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(11, JESSY, "Mau jadwal survei kak?")],
      stageTransitions: [
        { turn: 11, from: ConversationStage.PRICE_INFO, to: ConversationStage.CLOSING },
      ],
      finalScore: 70,
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "CLOSING_NOT_TOO_LATE")).toBe(0);
  });

  it("WARM lead (score 40), no closing attempt -> NO_CLOSING_ON_WARM_LEAD -3", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(3, JESSY, "Oke kak siap.")],
      stageTransitions: [],
      finalScore: 40,
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "NO_CLOSING_ON_WARM_LEAD")).toBe(-3);
  });

  it("COLD lead, no closing -> N/A (correct, no penalty)", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(3, JESSY, "Oke kak siap.")],
      stageTransitions: [],
      finalScore: 10,
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "NO_CLOSING_ON_WARM_LEAD")).toBe(0);
    expect(result.score.value).toBe(0);
  });

  it("closing attempted on a COLD lead (score < 20) -> CLOSING_ON_COLD_LEAD -2", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(3, JESSY, "Mau jadwal test drive kak?")],
      stageTransitions: [
        { turn: 3, from: ConversationStage.GREETING, to: ConversationStage.CLOSING },
      ],
      finalScore: 15,
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "CLOSING_ON_COLD_LEAD")).toBe(-2);
  });

  it("multiple identical closing messages -> SPAMMY_DUPLICATE_CLOSING -1", () => {
    const sim = makeSimulationResult({
      messages: [
        makeMessage(6, JESSY, "Mau jadwal test drive kak?"),
        makeMessage(7, JESSY, "Mau jadwal test drive kak?"),
      ],
      stageTransitions: [
        { turn: 6, from: ConversationStage.PRICE_INFO, to: ConversationStage.CLOSING },
      ],
      finalScore: 70,
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "SPAMMY_DUPLICATE_CLOSING")).toBe(-1);
  });

  it("closing message is natural (not the abrupt formal example) -> CLOSING_IS_NATURAL +1", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(6, JESSY, "Kalau cocok, kita jadwalin test drive yuk kak 😊")],
      stageTransitions: [
        { turn: 6, from: ConversationStage.PRICE_INFO, to: ConversationStage.CLOSING },
      ],
      finalScore: 70,
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "CLOSING_IS_NATURAL")).toBe(1);
  });

  it("abrupt formal closing question -> CLOSING_IS_NATURAL not awarded", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(6, JESSY, "Apakah Anda tertarik untuk survei?")],
      stageTransitions: [
        { turn: 6, from: ConversationStage.PRICE_INFO, to: ConversationStage.CLOSING },
      ],
      finalScore: 70,
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "CLOSING_IS_NATURAL")).toBe(0);
  });

  it("no closing reached at all -> only base rules apply, others are 0/no-op", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(3, JESSY, "Oke kak")],
      stageTransitions: [],
      finalScore: 25,
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "NO_CLOSING_ATTEMPT")).toBe(0);
    expect(result.appliedRules.some((r) => r.rule === "CLOSING_ATTEMPTED")).toBe(false);
    expect(ruleFrom(result.appliedRules, "MENTIONS_CLOSING_INTENT")).toBe(0);
    expect(ruleFrom(result.appliedRules, "CLOSING_NOT_TOO_LATE")).toBe(0);
    expect(ruleFrom(result.appliedRules, "CLOSING_IS_NATURAL")).toBe(0);
  });

  it("score is clamped 0-10", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(6, JESSY, "Kalau cocok, kita jadwalin test drive yuk kak 😊")],
      stageTransitions: [
        { turn: 6, from: ConversationStage.PRICE_INFO, to: ConversationStage.CLOSING },
      ],
      finalScore: 70,
    });
    const result = scorer.score(sim);
    expect(result.score.value).toBeLessThanOrEqual(10);
    expect(result.score.value).toBeGreaterThanOrEqual(0);
  });
});
