import type { PersonaId, SimulationResult } from "@aos/conversation-simulator";

import type { JudgementResult } from "./JudgementResult.js";

/**
 * A conversation worth saving as a reference for "what good Clara looks like" (spec "Golden
 * Dataset") — `overallScore >= goldenThreshold` (default 85). Used for regression testing
 * (future W3D Clara refinement) and future LLM fine-tuning data.
 */
export interface GoldenConversation {
  readonly id: string;
  readonly personaId: PersonaId;
  readonly simulationResult: SimulationResult;
  readonly judgementResult: JudgementResult;
  readonly savedAt: Date;
  readonly tags: ReadonlyArray<string>;
}
