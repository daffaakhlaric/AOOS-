import type { IPersonaStrategy } from "../../contracts/IPersonaStrategy.js";
import type { BuyerPersona } from "../../domain/entities/BuyerPersona.js";

/**
 * AI buyer generates next message (spec "PersonaResponseService.ts ← AI buyer generates next
 * message"). Design resolution #1: literal, not generative — simply returns
 * `persona.script[turnsSoFar]`, or `undefined` once every line has been consumed. No LLM call, no
 * looping, no fabricated text.
 */
export class PersonaResponseService implements IPersonaStrategy {
  nextMessage(persona: BuyerPersona, turnsSoFar: number): string | undefined {
    if (turnsSoFar < 0 || turnsSoFar >= persona.script.length) {
      return undefined;
    }
    return persona.script[turnsSoFar];
  }
}
