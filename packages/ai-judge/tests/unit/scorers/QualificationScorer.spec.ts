import { ConversationStage, LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { QualificationScorer } from "../../../src/scorers/QualificationScorer.js";
import { makeSimulationResult } from "../../fixtures/simulationResultFixtures.js";

const scorer = new QualificationScorer();

describe("QualificationScorer", () => {
  it("all 4 core flags -> score 10", () => {
    const sim = makeSimulationResult({
      expectedOutcome: LeadTemperature.HOT,
      scoreProgression: [
        { turn: 1, score: 25, delta: 25, reason: "BUDGET" },
        { turn: 1, score: 50, delta: 25, reason: "UNIT" },
        { turn: 1, score: 75, delta: 25, reason: "AREA" },
        { turn: 1, score: 100, delta: 25, reason: "PAYMENT" },
      ],
    });
    expect(scorer.score(sim).score.value).toBe(10);
  });

  it("2 flags (budget + unit) -> score 5", () => {
    const sim = makeSimulationResult({
      expectedOutcome: LeadTemperature.HOT,
      scoreProgression: [
        { turn: 1, score: 25, delta: 25, reason: "BUDGET" },
        { turn: 1, score: 50, delta: 25, reason: "UNIT" },
      ],
    });
    expect(scorer.score(sim).score.value).toBe(5);
  });

  it("timeline bonus adds +1 on top of the 4 core flags, clamped at 10", () => {
    const sim = makeSimulationResult({
      expectedOutcome: LeadTemperature.HOT,
      scoreProgression: [
        { turn: 1, score: 25, delta: 25, reason: "BUDGET" },
        { turn: 1, score: 50, delta: 25, reason: "UNIT" },
        { turn: 1, score: 75, delta: 25, reason: "AREA" },
        { turn: 1, score: 100, delta: 25, reason: "PAYMENT" },
        { turn: 1, score: 110, delta: 10, reason: "TIMELINE" },
      ],
    });
    expect(scorer.score(sim).score.value).toBe(10);
  });

  it("name bonus alone (no core flags, non-COLD expectation) -> score 1, not the COLD-attempt path", () => {
    const sim = makeSimulationResult({
      expectedOutcome: LeadTemperature.HOT,
      stageTransitions: [],
      scoreProgression: [{ turn: 1, score: 10, delta: 10, reason: "NAME" }],
    });
    expect(scorer.score(sim).score.value).toBe(1);
  });

  it("0 flags, tried to ask (COLD persona reaching DISCOVERY) -> score 5", () => {
    const sim = makeSimulationResult({
      expectedOutcome: LeadTemperature.COLD,
      scoreProgression: [],
      stageTransitions: [
        { turn: 1, from: ConversationStage.GREETING, to: ConversationStage.DISCOVERY },
      ],
    });
    expect(scorer.score(sim).score.value).toBe(5);
  });

  it("0 flags, tried to ask (COLD persona reaching QUALIFICATION) -> score 5", () => {
    const sim = makeSimulationResult({
      expectedOutcome: LeadTemperature.COLD,
      scoreProgression: [],
      stageTransitions: [
        { turn: 1, from: ConversationStage.GREETING, to: ConversationStage.QUALIFICATION },
      ],
    });
    expect(scorer.score(sim).score.value).toBe(5);
  });

  it("0 flags, no attempt (COLD persona never leaves GREETING) -> score 0", () => {
    const sim = makeSimulationResult({
      expectedOutcome: LeadTemperature.COLD,
      scoreProgression: [],
      stageTransitions: [],
    });
    expect(scorer.score(sim).score.value).toBe(0);
  });

  it("0 flags, non-COLD expected persona -> score 0 (attempt branch does not apply)", () => {
    const sim = makeSimulationResult({
      expectedOutcome: LeadTemperature.HOT,
      scoreProgression: [],
      stageTransitions: [
        { turn: 1, from: ConversationStage.GREETING, to: ConversationStage.DISCOVERY },
      ],
    });
    expect(scorer.score(sim).score.value).toBe(0);
  });

  it("COLD-expected persona that DID extract flags is scored normally, not via the attempt branch", () => {
    const sim = makeSimulationResult({
      expectedOutcome: LeadTemperature.COLD,
      scoreProgression: [
        { turn: 1, score: 25, delta: 25, reason: "BUDGET" },
        { turn: 1, score: 50, delta: 25, reason: "UNIT" },
      ],
      stageTransitions: [],
    });
    expect(scorer.score(sim).score.value).toBe(5);
  });
});
