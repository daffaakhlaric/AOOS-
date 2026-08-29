import { describe, expect, it } from "vitest";

import { DimensionName } from "../../../src/domain/value-objects/DimensionName.js";
import { NaturalLanguageScorer } from "../../../src/scorers/NaturalLanguageScorer.js";
import {
  CLARA,
  BUYER,
  makeMessage,
  makeSimulationResult,
} from "../../fixtures/simulationResultFixtures.js";

function ruleFrom(
  appliedRules: ReadonlyArray<{ rule: string; points: number }>,
  rule: string,
): number {
  return appliedRules.find((r) => r.rule === rule)?.points ?? NaN;
}

const scorer = new NaturalLanguageScorer();

describe("NaturalLanguageScorer", () => {
  it("returns dimension NATURAL_LANGUAGE", () => {
    const result = scorer.score(makeSimulationResult());
    expect(result.dimension).toBe(DimensionName.NATURAL_LANGUAGE);
  });

  it("response <= 150 chars -> CONCISE +2", () => {
    const sim = makeSimulationResult({ messages: [makeMessage(1, CLARA, "singkat aja kak")] });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "CONCISE")).toBe(2);
  });

  it("response > 150 chars for any message -> CONCISE not awarded", () => {
    const long = "x".repeat(151);
    const sim = makeSimulationResult({ messages: [makeMessage(1, CLARA, long)] });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "CONCISE")).toBe(0);
  });

  it("contains emoji -> USES_EMOJI +2", () => {
    const sim = makeSimulationResult({ messages: [makeMessage(1, CLARA, "oke kak 😊")] });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "USES_EMOJI")).toBe(2);
  });

  it("no emoji anywhere -> USES_EMOJI not awarded", () => {
    const sim = makeSimulationResult({ messages: [makeMessage(1, CLARA, "oke kak tanpa emoji")] });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "USES_EMOJI")).toBe(0);
  });

  it('uses "kak" -> CASUAL_WORDS +2', () => {
    const sim = makeSimulationResult({ messages: [makeMessage(1, CLARA, "boleh kak")] });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "CASUAL_WORDS")).toBe(2);
  });

  it('uses "nih", "deh", "dong", "sih" -> CASUAL_WORDS +2 each', () => {
    for (const word of ["nih", "deh", "dong", "sih"]) {
      const sim = makeSimulationResult({ messages: [makeMessage(1, CLARA, `oke ${word} banget`)] });
      const result = scorer.score(sim);
      expect(ruleFrom(result.appliedRules, "CASUAL_WORDS")).toBe(2);
    }
  });

  it("no casual words anywhere -> CASUAL_WORDS not awarded", () => {
    const sim = makeSimulationResult({ messages: [makeMessage(1, CLARA, "baik terima kasih")] });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "CASUAL_WORDS")).toBe(0);
  });

  it("no formal stiff phrase -> NO_FORMAL_PHRASES +2", () => {
    const sim = makeSimulationResult({ messages: [makeMessage(1, CLARA, "halo kak")] });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "NO_FORMAL_PHRASES")).toBe(2);
  });

  it('formal opener "Dengan hormat" -> NO_FORMAL_PHRASES not awarded', () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(1, CLARA, "Dengan hormat, kami sampaikan...")],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "NO_FORMAL_PHRASES")).toBe(0);
  });

  it('formal opener "Perkenalkan" -> NO_FORMAL_PHRASES not awarded', () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(1, CLARA, "Perkenalkan, saya Clara.")],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "NO_FORMAL_PHRASES")).toBe(0);
  });

  it("varied responses across turns -> VARIED_RESPONSES +2, SAME_PATTERN_TWO_IN_A_ROW not applied", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(1, CLARA, "halo kak"), makeMessage(2, CLARA, "oke kak siap")],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "VARIED_RESPONSES")).toBe(2);
    expect(ruleFrom(result.appliedRules, "SAME_PATTERN_TWO_IN_A_ROW")).toBe(0);
  });

  it("same response twice in a row -> VARIED_RESPONSES not awarded, SAME_PATTERN_TWO_IN_A_ROW -1", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(1, CLARA, "oke kak siap"), makeMessage(2, CLARA, "oke kak siap")],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "VARIED_RESPONSES")).toBe(0);
    expect(ruleFrom(result.appliedRules, "SAME_PATTERN_TWO_IN_A_ROW")).toBe(-1);
  });

  it("response > 300 chars -> TOO_LONG -3", () => {
    const long = "y".repeat(301);
    const sim = makeSimulationResult({ messages: [makeMessage(1, CLARA, long)] });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "TOO_LONG")).toBe(-3);
  });

  it("no message > 300 chars -> TOO_LONG not applied", () => {
    const sim = makeSimulationResult({ messages: [makeMessage(1, CLARA, "pendek")] });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "TOO_LONG")).toBe(0);
  });

  it("contains a bulleted list -> BULLET_OR_LIST -2", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(1, CLARA, "Unit tersedia:\n- Xpander\n- Brio")],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "BULLET_OR_LIST")).toBe(-2);
  });

  it("contains a numbered list -> BULLET_OR_LIST -2", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(1, CLARA, "Info:\n1. Harga\n2. Cicilan")],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "BULLET_OR_LIST")).toBe(-2);
  });

  it("starts with the robot greeting -> ROBOT_GREETING -2", () => {
    const sim = makeSimulationResult({
      messages: [
        makeMessage(1, CLARA, "Halo, saya Clara dari Mobix By DSS Motor, ada yang bisa dibantu?"),
      ],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "ROBOT_GREETING")).toBe(-2);
  });

  it("does not start with the robot greeting -> ROBOT_GREETING not applied", () => {
    const sim = makeSimulationResult({ messages: [makeMessage(1, CLARA, "Halo kak!")] });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "ROBOT_GREETING")).toBe(0);
  });

  it("no Clara messages at all -> score 0 with a NO_CLARA_MESSAGES note", () => {
    const sim = makeSimulationResult({ messages: [makeMessage(1, BUYER, "halo min")] });
    const result = scorer.score(sim);
    expect(result.score.value).toBe(0);
    expect(result.appliedRules[0]?.rule).toBe("NO_CLARA_MESSAGES");
  });

  it("score is clamped to [0, 10] even when every positive rule fires", () => {
    const sim = makeSimulationResult({
      messages: [makeMessage(1, CLARA, "halo kak 😊"), makeMessage(2, CLARA, "oke sip nih 🙏")],
    });
    const result = scorer.score(sim);
    expect(result.score.value).toBeLessThanOrEqual(10);
    expect(result.score.value).toBeGreaterThanOrEqual(0);
  });

  it("all-negative message clamps the score down to 0, not below", () => {
    const robotic = `Halo, saya Clara dari Mobix By DSS Motor. Dengan hormat, ${"z".repeat(300)}\n- item1\n- item2`;
    const sim = makeSimulationResult({
      messages: [makeMessage(1, CLARA, robotic), makeMessage(2, CLARA, robotic)],
    });
    const result = scorer.score(sim);
    expect(result.score.value).toBe(0);
  });
});
