import type { SimulationMessage } from "@aos/conversation-simulator";

/**
 * `@aos/conversation-simulator`'s `SimulationSpeaker` enum is not re-exported from that
 * package's top-level `index.ts` (only the `SimulationMessage`/`SimulationResult` *types* are —
 * see `packages/conversation-simulator/src/index.ts`'s "Domain" section), and its `package.json`
 * `exports` map only allows the `"."` subpath, so a deep import of the enum's own module is not
 * possible either. These two literal string constants — whose runtime values are exactly
 * `SimulationSpeaker.CLARA`/`SimulationSpeaker.BUYER`'s underlying string values (`"CLARA"`/
 * `"BUYER"`, per `SimulationMessage.ts`'s `enum SimulationSpeaker { BUYER = "BUYER", CLARA =
 * "CLARA" }`) — are the narrowest available substitute, typed against `SimulationMessage["speaker"]`
 * so a future rename of the enum's string values would fail typecheck here rather than silently
 * mismatch at runtime.
 */
type Speaker = SimulationMessage["speaker"];

export const CLARA_SPEAKER = "CLARA" as Speaker;
export const BUYER_SPEAKER = "BUYER" as Speaker;

export function claraMessages(
  messages: ReadonlyArray<SimulationMessage>,
): ReadonlyArray<SimulationMessage> {
  return messages.filter((m) => m.speaker === CLARA_SPEAKER);
}

export function buyerMessages(
  messages: ReadonlyArray<SimulationMessage>,
): ReadonlyArray<SimulationMessage> {
  return messages.filter((m) => m.speaker === BUYER_SPEAKER);
}
