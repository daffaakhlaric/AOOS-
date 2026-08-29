import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { HandoffQualityScorer } from "../../../src/scorers/HandoffQualityScorer.js";
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

const scorer = new HandoffQualityScorer();

describe("HandoffQualityScorer", () => {
  it("handoffTriggered=true, score>=65 at handoff, warm message, <=10 turns, mentions tim kita -> +4+3+2+1", () => {
    const sim = makeSimulationResult({
      handoffTriggered: true,
      handoffAtTurn: 6,
      finalTemperature: LeadTemperature.HOT,
      finalScore: 70,
      scoreProgression: [{ turn: 6, score: 70, delta: 5, reason: "BUDGET" }],
      messages: [makeMessage(6, CLARA, "Oke kak! Clara sambungin ke Andi dari tim kita ya 🙏")],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "CORRECT_THRESHOLD")).toBe(4);
    expect(ruleFrom(result.appliedRules, "WARM_MESSAGE")).toBe(3);
    expect(ruleFrom(result.appliedRules, "REASONABLE_TURNS")).toBe(2);
    expect(ruleFrom(result.appliedRules, "MENTIONS_SALES_TEAM")).toBe(1);
    expect(result.score.value).toBe(10);
  });

  it("HOT lead, no handoff -> score 0", () => {
    const sim = makeSimulationResult({
      handoffTriggered: false,
      handoffAtTurn: undefined,
      finalTemperature: LeadTemperature.HOT,
    });
    const result = scorer.score(sim);
    expect(result.score.value).toBe(0);
    expect(result.appliedRules[0]?.rule).toBe("HOT_LEAD_NO_HANDOFF");
  });

  it("lead never reached HOT, no handoff -> score 10 (N/A, correct)", () => {
    const sim = makeSimulationResult({
      handoffTriggered: false,
      handoffAtTurn: undefined,
      finalTemperature: LeadTemperature.WARM,
    });
    const result = scorer.score(sim);
    expect(result.score.value).toBe(10);
    expect(result.appliedRules[0]?.rule).toBe("NO_HANDOFF_NEEDED");
  });

  it("handoff at score 45 -> PREMATURE_HANDOFF -3", () => {
    const sim = makeSimulationResult({
      handoffTriggered: true,
      handoffAtTurn: 4,
      finalScore: 45,
      scoreProgression: [{ turn: 4, score: 45, delta: 5, reason: "BUDGET" }],
      messages: [makeMessage(4, CLARA, "Oke kak! Clara sambungin ke tim kita ya 🙏")],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "PREMATURE_HANDOFF")).toBe(-3);
    expect(ruleFrom(result.appliedRules, "CORRECT_THRESHOLD")).toBe(0);
  });

  it("handoff after turn 10 -> REASONABLE_TURNS not awarded", () => {
    const sim = makeSimulationResult({
      handoffTriggered: true,
      handoffAtTurn: 12,
      finalScore: 70,
      scoreProgression: [{ turn: 12, score: 70, delta: 5, reason: "BUDGET" }],
      messages: [makeMessage(12, CLARA, "Oke kak! Clara sambungin ke tim kita ya 🙏")],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "REASONABLE_TURNS")).toBe(0);
  });

  it("robotic/formal handoff message -> ROBOTIC_MESSAGE -2, WARM_MESSAGE not awarded", () => {
    const sim = makeSimulationResult({
      handoffTriggered: true,
      handoffAtTurn: 6,
      finalScore: 70,
      scoreProgression: [{ turn: 6, score: 70, delta: 5, reason: "BUDGET" }],
      messages: [
        makeMessage(6, CLARA, "Dengan hormat, Perkenalkan tim sales kami akan menghubungi Anda."),
      ],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "ROBOTIC_MESSAGE")).toBe(-2);
    expect(ruleFrom(result.appliedRules, "WARM_MESSAGE")).toBe(0);
  });

  it("handoff message doesn't mention sales team -> MENTIONS_SALES_TEAM not awarded", () => {
    const sim = makeSimulationResult({
      handoffTriggered: true,
      handoffAtTurn: 6,
      finalScore: 70,
      scoreProgression: [{ turn: 6, score: 70, delta: 5, reason: "BUDGET" }],
      messages: [makeMessage(6, CLARA, "Oke kak 🙏 sebentar ya")],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MENTIONS_SALES_TEAM")).toBe(0);
  });

  it("falls back to the next Clara message when none exists exactly at the handoff turn", () => {
    const sim = makeSimulationResult({
      handoffTriggered: true,
      handoffAtTurn: 5,
      finalScore: 70,
      scoreProgression: [{ turn: 5, score: 70, delta: 5, reason: "BUDGET" }],
      messages: [makeMessage(6, CLARA, "Oke kak! Clara sambungin ke tim kita ya 🙏")],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MENTIONS_SALES_TEAM")).toBe(1);
  });

  it("defaults to an empty message when no Clara message exists at or after the handoff turn", () => {
    const sim = makeSimulationResult({
      handoffTriggered: true,
      handoffAtTurn: 5,
      finalScore: 70,
      scoreProgression: [{ turn: 5, score: 70, delta: 5, reason: "BUDGET" }],
      messages: [],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "MENTIONS_SALES_TEAM")).toBe(0);
    expect(ruleFrom(result.appliedRules, "ROBOTIC_MESSAGE")).toBe(-2);
  });

  it("falls back to finalScore when no scoreProgression entry exists at/before handoff turn", () => {
    const sim = makeSimulationResult({
      handoffTriggered: true,
      handoffAtTurn: 3,
      finalScore: 70,
      scoreProgression: [],
      messages: [makeMessage(3, CLARA, "Oke kak! Clara sambungin ke tim kita ya 🙏")],
    });
    const result = scorer.score(sim);
    expect(ruleFrom(result.appliedRules, "CORRECT_THRESHOLD")).toBe(4);
  });

  it("score is clamped 0-10", () => {
    const sim = makeSimulationResult({
      handoffTriggered: true,
      handoffAtTurn: 6,
      finalScore: 70,
      scoreProgression: [{ turn: 6, score: 70, delta: 5, reason: "BUDGET" }],
      messages: [makeMessage(6, CLARA, "Oke kak! Clara sambungin ke tim kita ya 🙏")],
    });
    const result = scorer.score(sim);
    expect(result.score.value).toBeLessThanOrEqual(10);
    expect(result.score.value).toBeGreaterThanOrEqual(0);
  });
});
