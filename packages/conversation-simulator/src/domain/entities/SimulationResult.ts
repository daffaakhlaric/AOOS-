import type { ConversationStage, LeadTemperature } from "@aos/sales-agent";

import type { PersonaDifficulty } from "../value-objects/PersonaDifficulty.js";
import type { PersonaId } from "../value-objects/PersonaId.js";
import type { SessionId } from "../value-objects/SessionId.js";
import type { SimulationStatus } from "../value-objects/SimulationStatus.js";

import type { SimulationMessage } from "./SimulationMessage.js";
import type { ScoreProgressionEntry, StageTransitionEntry } from "./SimulationSession.js";

/**
 * Full simulation record for `@aos/ai-judge` (W3B) to score (spec "SimulationResult (for AI
 * Judge)"). Every field matches the spec's literal interface, plus one additive extension
 * documented inline below (`followUpScheduled`) — no spec field was removed or renamed.
 */
export interface SimulationResult {
  readonly sessionId: SessionId;
  readonly personaId: PersonaId;
  readonly personaDifficulty: PersonaDifficulty;
  readonly status: SimulationStatus;

  // Conversation record
  readonly messages: ReadonlyArray<SimulationMessage>;
  readonly totalTurns: number;
  readonly durationMs: number;

  // Clara performance
  readonly finalScore: number;
  readonly finalTemperature: LeadTemperature;
  readonly handoffTriggered: boolean;
  readonly handoffAtTurn?: number;
  readonly scoreProgression: ReadonlyArray<ScoreProgressionEntry>;

  // Stage transitions
  readonly stageTransitions: ReadonlyArray<StageTransitionEntry>;
  readonly finalStage?: ConversationStage;

  // Expected vs actual
  readonly expectedOutcome: LeadTemperature;
  readonly metExpectation: boolean;

  // Message analysis
  readonly avgClaraResponseLength: number;
  readonly maxClaraResponseLength: number;
  readonly longestClaraMessage: string;
  readonly claraUsedInventory: boolean;
  readonly claraHandledObjection: boolean;

  /**
   * Additive extension beyond the spec's literal interface (design resolution #3): `true` once
   * `@aos/sales-agent`'s real `FollowUpScheduled` event has been observed for this session — the
   * concrete, observable signal `RunSimulation.spec.ts`'s "GhostBuyer → follow up scheduled"
   * business-correctness assertion needs, since the spec's own `SimulationResult` shape has no
   * field for it.
   */
  readonly followUpScheduled: boolean;
}
