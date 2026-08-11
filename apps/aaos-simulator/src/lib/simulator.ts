import type { Result } from "@aos/common";
import {
  SimulatorFactory,
  DEFAULT_SIMULATOR_CONFIG,
  type Simulator,
  type SimulationResult,
  type SimulatorError,
} from "@aos/conversation-simulator";

import type { SimulationResultDto } from "../types/simulator.types";

/**
 * Server-side composition of `@aos/conversation-simulator` (spec "lib/simulator.ts": "init
 * SimulatorFactory"). `SimulatorFactory.create()` is fully self-contained — it composes its own
 * fresh `@aos/branch-manager`/`@aos/dss-inventory-connector`/`@aos/sales-agent` instances inside
 * `JessySimulationComposer` per simulation session (see `packages/conversation-simulator/src/
 * application/services/JessySimulationComposer.ts`) — so this module does not (and should not)
 * wire those three packages in manually.
 *
 * Never imported into a `"use client"` component (design resolution #5) — only the two Route
 * Handlers under `src/app/api/**` call this.
 */
let cachedSimulator: Simulator | undefined;

export function getSimulator(): Result<Simulator, SimulatorError> {
  if (cachedSimulator) {
    return { ok: true, value: cachedSimulator };
  }
  const created = SimulatorFactory.create();
  if (created.ok) {
    cachedSimulator = created.value;
  }
  return created;
}

export { DEFAULT_SIMULATOR_CONFIG };

/**
 * Maps the real `SimulationResult` (whose `sessionId`/`personaId`/enum fields include class-based
 * value objects such as `SessionId`, which do not survive `JSON.stringify` with their methods
 * intact — only their private `raw` field would leak through as `{ raw: "..." }`) into a plain,
 * JSON-safe DTO for the two Route Handlers to return. String enums (`PersonaId`,
 * `PersonaDifficulty`, `SimulationStatus`, `LeadTemperature`, `ConversationStage`) already
 * serialize losslessly as their string values, so those pass through unchanged.
 */
export function toSimulationResultDto(result: SimulationResult): SimulationResultDto {
  return {
    sessionId: result.sessionId.toString(),
    personaId: result.personaId,
    personaDifficulty: result.personaDifficulty,
    status: result.status,
    messages: result.messages.map((m) => ({
      turn: m.turn,
      speaker: m.speaker,
      text: m.text,
      occurredAt: m.occurredAt.toISOString(),
    })),
    totalTurns: result.totalTurns,
    durationMs: result.durationMs,
    finalScore: result.finalScore,
    finalTemperature: result.finalTemperature,
    handoffTriggered: result.handoffTriggered,
    handoffAtTurn: result.handoffAtTurn,
    scoreProgression: result.scoreProgression.map((s) => ({ ...s })),
    stageTransitions: result.stageTransitions.map((s) => ({ ...s })),
    finalStage: result.finalStage,
    expectedOutcome: result.expectedOutcome,
    metExpectation: result.metExpectation,
    avgJessyResponseLength: result.avgJessyResponseLength,
    maxJessyResponseLength: result.maxJessyResponseLength,
    longestJessyMessage: result.longestJessyMessage,
    jessyUsedInventory: result.jessyUsedInventory,
    jessyHandledObjection: result.jessyHandledObjection,
    followUpScheduled: result.followUpScheduled,
  };
}
