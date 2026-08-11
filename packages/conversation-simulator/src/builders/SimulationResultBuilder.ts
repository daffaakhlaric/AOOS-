import { ConversationStage, type LeadTemperature } from "@aos/sales-agent";

import type { BuyerPersona } from "../domain/entities/BuyerPersona.js";
import { SimulationSpeaker, type SimulationMessage } from "../domain/entities/SimulationMessage.js";
import type { SimulationResult } from "../domain/entities/SimulationResult.js";
import type { SimulationSession } from "../domain/entities/SimulationSession.js";

/** Builder Pattern: turns a folded `SimulationSession` into the public `SimulationResult` (spec "builders/SimulationResultBuilder.ts") — the message-analysis aggregates (`avgJessyResponseLength`, `maxJessyResponseLength`, `longestJessyMessage`) are computed here, once, from the session's own recorded messages. */
export class SimulationResultBuilder {
  static build(
    session: SimulationSession,
    persona: BuyerPersona,
    durationMs: number,
    finalScore: number,
    finalTemperature: LeadTemperature,
  ): SimulationResult {
    const jessyMessages = session.messages.filter(
      (m: SimulationMessage) => m.speaker === SimulationSpeaker.JESSY,
    );
    const lengths = jessyMessages.map((m) => m.text.length);
    const maxJessyResponseLength = lengths.length === 0 ? 0 : Math.max(...lengths);
    const longestJessyMessage =
      jessyMessages.find((m) => m.text.length === maxJessyResponseLength)?.text ?? "";
    const avgJessyResponseLength =
      lengths.length === 0 ? 0 : lengths.reduce((sum, len) => sum + len, 0) / lengths.length;

    const jessyHandledObjection = session.stageTransitions.some(
      (t) => t.to === ConversationStage.OBJECTION,
    );

    return {
      sessionId: session.id,
      personaId: session.personaId,
      personaDifficulty: session.personaDifficulty,
      status: session.status,
      messages: session.messages,
      totalTurns: session.turnCount.toNumber(),
      durationMs,
      finalScore,
      finalTemperature,
      handoffTriggered: session.handoffTriggered,
      handoffAtTurn: session.handoffAtTurn,
      scoreProgression: session.scoreProgression,
      stageTransitions: session.stageTransitions,
      finalStage: session.currentStage,
      expectedOutcome: persona.expectedOutcome,
      metExpectation: finalTemperature === persona.expectedOutcome,
      avgJessyResponseLength,
      maxJessyResponseLength,
      longestJessyMessage,
      jessyUsedInventory: session.jessyUsedInventory,
      jessyHandledObjection,
      followUpScheduled: session.followUpScheduled,
    };
  }
}
