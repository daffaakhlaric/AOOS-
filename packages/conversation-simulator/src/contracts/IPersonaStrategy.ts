import type { BuyerPersona } from "../domain/entities/BuyerPersona.js";

/**
 * Strategy Pattern port: generates the AI buyer's next message for one simulation turn.
 *
 * Design resolution #1 — literal script consumption, not generative: implementations simply
 * return the next unconsumed line from `persona.script`. When the script is exhausted, `undefined`
 * is returned (an explicit "exhausted" signal) — never a looped/repeated/fabricated message.
 */
export interface IPersonaStrategy {
  /**
   * @param persona The buyer persona driving this session.
   * @param turnsSoFar How many of the persona's messages have already been sent (0-indexed cursor).
   * @returns The next message text, or `undefined` if the persona's script is exhausted.
   */
  nextMessage(persona: BuyerPersona, turnsSoFar: number): string | undefined;
}
