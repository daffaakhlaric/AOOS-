import { ConversationStage, LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { SimulationResultBuilder } from "../../../src/builders/SimulationResultBuilder.js";
import { SimulationSpeaker } from "../../../src/domain/entities/SimulationMessage.js";
import { SimulationSession } from "../../../src/domain/entities/SimulationSession.js";
import { PersonaDifficulty } from "../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../src/domain/value-objects/PersonaId.js";
import { SessionId } from "../../../src/domain/value-objects/SessionId.js";
import { SimulationStatus } from "../../../src/domain/value-objects/SimulationStatus.js";
import { ReadyBuyer } from "../../../src/personas/ReadyBuyer.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

function baseSession(): SimulationSession {
  return SimulationSession.start(
    SessionId.create("sim-1"),
    PersonaId.READY_BUYER,
    PersonaDifficulty.EASY,
    NOW.getTime(),
  );
}

describe("SimulationResultBuilder", () => {
  it("builds a SimulationResult carrying every session field through", () => {
    const session = baseSession()
      .withAppendedMessage({
        turn: 1,
        speaker: SimulationSpeaker.BUYER,
        text: "halo kak mau beli Xpander",
        occurredAt: NOW,
      })
      .withAppendedMessage({
        turn: 1,
        speaker: SimulationSpeaker.CLARA,
        text: "Halo kak!",
        occurredAt: NOW,
      })
      .withIncrementedTurn()
      .withScoreProgressionEntry({ turn: 1, score: 25, delta: 25, reason: "UNIT" })
      .withStageTransition({
        turn: 1,
        from: ConversationStage.GREETING,
        to: ConversationStage.UNIT_INFO,
      })
      .withHandoff(3)
      .withCurrentTemperature(LeadTemperature.HOT)
      .withCurrentScore(80)
      .withStatus(SimulationStatus.COMPLETED);

    const result = SimulationResultBuilder.build(
      session,
      ReadyBuyer,
      1234,
      80,
      LeadTemperature.HOT,
    );

    expect(result.sessionId).toBe(session.id);
    expect(result.personaId).toBe(PersonaId.READY_BUYER);
    expect(result.personaDifficulty).toBe(PersonaDifficulty.EASY);
    expect(result.status).toBe(SimulationStatus.COMPLETED);
    expect(result.totalTurns).toBe(1);
    expect(result.durationMs).toBe(1234);
    expect(result.finalScore).toBe(80);
    expect(result.finalTemperature).toBe(LeadTemperature.HOT);
    expect(result.handoffTriggered).toBe(true);
    expect(result.handoffAtTurn).toBe(3);
    expect(result.scoreProgression).toHaveLength(1);
    expect(result.stageTransitions).toHaveLength(1);
    expect(result.expectedOutcome).toBe(LeadTemperature.HOT);
    expect(result.metExpectation).toBe(true);
    expect(result.claraUsedInventory).toBe(false);
  });

  it("computes avg/max/longest Clara response length from CLARA-speaker messages only", () => {
    const session = baseSession()
      .withAppendedMessage({
        turn: 1,
        speaker: SimulationSpeaker.BUYER,
        text: "a very long buyer message that should be ignored",
        occurredAt: NOW,
      })
      .withAppendedMessage({
        turn: 1,
        speaker: SimulationSpeaker.CLARA,
        text: "short",
        occurredAt: NOW,
      })
      .withAppendedMessage({
        turn: 2,
        speaker: SimulationSpeaker.CLARA,
        text: "a longer clara reply",
        occurredAt: NOW,
      });

    const result = SimulationResultBuilder.build(session, ReadyBuyer, 0, 0, LeadTemperature.COLD);

    expect(result.maxClaraResponseLength).toBe("a longer clara reply".length);
    expect(result.longestClaraMessage).toBe("a longer clara reply");
    expect(result.avgClaraResponseLength).toBe(
      ("short".length + "a longer clara reply".length) / 2,
    );
  });

  it("defaults message-length aggregates to 0/empty when there are no Clara messages", () => {
    const session = baseSession();
    const result = SimulationResultBuilder.build(session, ReadyBuyer, 0, 0, LeadTemperature.COLD);
    expect(result.avgClaraResponseLength).toBe(0);
    expect(result.maxClaraResponseLength).toBe(0);
    expect(result.longestClaraMessage).toBe("");
  });

  it("claraHandledObjection is true only when a stage transition targets OBJECTION", () => {
    const withObjection = baseSession().withStageTransition({
      turn: 2,
      from: ConversationStage.GREETING,
      to: ConversationStage.OBJECTION,
    });
    const withoutObjection = baseSession().withStageTransition({
      turn: 2,
      from: ConversationStage.GREETING,
      to: ConversationStage.DISCOVERY,
    });

    expect(
      SimulationResultBuilder.build(withObjection, ReadyBuyer, 0, 0, LeadTemperature.COLD)
        .claraHandledObjection,
    ).toBe(true);
    expect(
      SimulationResultBuilder.build(withoutObjection, ReadyBuyer, 0, 0, LeadTemperature.COLD)
        .claraHandledObjection,
    ).toBe(false);
  });

  it("metExpectation is false when the final temperature doesn't match expectedOutcome", () => {
    const session = baseSession();
    const result = SimulationResultBuilder.build(session, ReadyBuyer, 0, 0, LeadTemperature.COLD);
    expect(result.expectedOutcome).toBe(LeadTemperature.HOT);
    expect(result.metExpectation).toBe(false);
  });

  it("finalStage reflects the session's currentStage at build time", () => {
    const session = baseSession().withStageTransition({
      turn: 1,
      from: ConversationStage.GREETING,
      to: ConversationStage.PRICE_INFO,
    });
    const result = SimulationResultBuilder.build(session, ReadyBuyer, 0, 0, LeadTemperature.COLD);
    expect(result.finalStage).toBe(ConversationStage.PRICE_INFO);
  });

  it("followUpScheduled and claraUsedInventory pass through from the session", () => {
    const session = baseSession().withFollowUpScheduled().withClaraUsedInventory();
    const result = SimulationResultBuilder.build(session, ReadyBuyer, 0, 0, LeadTemperature.COLD);
    expect(result.followUpScheduled).toBe(true);
    expect(result.claraUsedInventory).toBe(true);
  });
});
