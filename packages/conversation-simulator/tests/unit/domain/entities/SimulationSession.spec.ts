import { ConversationStage, LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { SimulationSpeaker } from "../../../../src/domain/entities/SimulationMessage.js";
import { SimulationSession } from "../../../../src/domain/entities/SimulationSession.js";
import { PersonaDifficulty } from "../../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../../src/domain/value-objects/PersonaId.js";
import { SessionId } from "../../../../src/domain/value-objects/SessionId.js";
import { SimulationStatus } from "../../../../src/domain/value-objects/SimulationStatus.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

function freshSession(): SimulationSession {
  return SimulationSession.start(
    SessionId.create("sim-test-1"),
    PersonaId.COLD_BUYER,
    PersonaDifficulty.EASY,
    NOW.getTime(),
  );
}

describe("SimulationSession", () => {
  it("start() initializes RUNNING, empty messages, turn 0, GREETING/COLD/score 0", () => {
    const session = freshSession();
    expect(session.status).toBe(SimulationStatus.RUNNING);
    expect(session.messages).toEqual([]);
    expect(session.turnCount.toNumber()).toBe(0);
    expect(session.currentStage).toBe(ConversationStage.GREETING);
    expect(session.currentTemperature).toBe(LeadTemperature.COLD);
    expect(session.currentScore).toBe(0);
    expect(session.handoffTriggered).toBe(false);
    expect(session.handoffAtTurn).toBeUndefined();
    expect(session.followUpScheduled).toBe(false);
    expect(session.jessyUsedInventory).toBe(false);
    expect(session.personaId).toBe(PersonaId.COLD_BUYER);
    expect(session.personaDifficulty).toBe(PersonaDifficulty.EASY);
    expect(session.startedAtMs).toBe(NOW.getTime());
  });

  it("withAppendedMessage() appends without mutating the original", () => {
    const session = freshSession();
    const withMsg = session.withAppendedMessage({
      turn: 1,
      speaker: SimulationSpeaker.BUYER,
      text: "halo",
      occurredAt: NOW,
    });
    expect(session.messages).toHaveLength(0);
    expect(withMsg.messages).toHaveLength(1);
    expect(withMsg.messages[0]?.text).toBe("halo");
  });

  it("withIncrementedTurn() bumps the turn counter", () => {
    const session = freshSession().withIncrementedTurn().withIncrementedTurn();
    expect(session.turnCount.toNumber()).toBe(2);
  });

  it("withScoreProgressionEntry() appends and updates currentScore", () => {
    const session = freshSession().withScoreProgressionEntry({
      turn: 1,
      score: 25,
      delta: 25,
      reason: "BUDGET",
    });
    expect(session.scoreProgression).toHaveLength(1);
    expect(session.currentScore).toBe(25);
  });

  it("withStageTransition() appends and updates currentStage", () => {
    const session = freshSession().withStageTransition({
      turn: 1,
      from: ConversationStage.GREETING,
      to: ConversationStage.DISCOVERY,
    });
    expect(session.stageTransitions).toHaveLength(1);
    expect(session.currentStage).toBe(ConversationStage.DISCOVERY);
  });

  it("withCurrentTemperature() / withCurrentScore() update independently", () => {
    const session = freshSession()
      .withCurrentTemperature(LeadTemperature.WARM)
      .withCurrentScore(50);
    expect(session.currentTemperature).toBe(LeadTemperature.WARM);
    expect(session.currentScore).toBe(50);
  });

  it("withHandoff() sets handoffTriggered + handoffAtTurn", () => {
    const session = freshSession().withHandoff(3);
    expect(session.handoffTriggered).toBe(true);
    expect(session.handoffAtTurn).toBe(3);
  });

  it("withFollowUpScheduled() / withJessyUsedInventory() flip their booleans", () => {
    const session = freshSession().withFollowUpScheduled().withJessyUsedInventory();
    expect(session.followUpScheduled).toBe(true);
    expect(session.jessyUsedInventory).toBe(true);
  });

  it("withStatus() replaces status without touching other fields", () => {
    const session = freshSession().withStatus(SimulationStatus.COMPLETED);
    expect(session.status).toBe(SimulationStatus.COMPLETED);
    expect(session.turnCount.toNumber()).toBe(0);
  });

  it("multiple stage transitions accumulate in order", () => {
    const session = freshSession()
      .withStageTransition({
        turn: 1,
        from: ConversationStage.GREETING,
        to: ConversationStage.DISCOVERY,
      })
      .withStageTransition({
        turn: 2,
        from: ConversationStage.DISCOVERY,
        to: ConversationStage.UNIT_INFO,
      });
    expect(session.stageTransitions).toHaveLength(2);
    expect(session.currentStage).toBe(ConversationStage.UNIT_INFO);
  });

  it("with* methods never mutate the receiver (immutability)", () => {
    const original = freshSession();
    original.withIncrementedTurn();
    original.withCurrentScore(99);
    original.withStatus(SimulationStatus.COMPLETED);
    expect(original.turnCount.toNumber()).toBe(0);
    expect(original.currentScore).toBe(0);
    expect(original.status).toBe(SimulationStatus.RUNNING);
  });

  it("id getter exposes the SessionId passed to start()", () => {
    const session = freshSession();
    expect(session.id.toString()).toBe("sim-test-1");
  });
});
