import type { LeadTemperature } from "@aos/sales-agent";

import type { PersonaDifficulty } from "../domain/value-objects/PersonaDifficulty.js";
import type { PersonaId } from "../domain/value-objects/PersonaId.js";

/**
 * Shape every one of the 10 fixed buyer personas (spec "10 Buyer Personas") must satisfy.
 * `script` mechanics are literal, not generative (design resolution #1) — a fixed, ordered array
 * of Indonesian message strings; there is no LLM call anywhere in this package (constitution: "no
 * LLM calls" was already established for Clara herself in W2D and applies equally to the AI buyer
 * side here).
 */
export interface IBuyerPersona {
  readonly id: PersonaId;
  readonly name: string;
  readonly difficulty: PersonaDifficulty;
  /** Short Indonesian description of who this buyer is (mirrors the spec's inline `//` comment per persona). */
  readonly description: string;
  readonly script: ReadonlyArray<string>;
  readonly expectedOutcome: LeadTemperature;
  readonly maxTurns: number;
  /** `true` only for personas the spec pins an explicit handoff expectation on (`ReadyBuyer`, `SyariahBuyer`, `UrgentBuyer`). */
  readonly expectedHandoff?: boolean;
  /** `true` only for `GhostBuyer` — signals the simulator must additionally exercise Clara's no-reply timeout path once the script goes silent (design resolution #3). */
  readonly testFollowUp?: boolean;
}
