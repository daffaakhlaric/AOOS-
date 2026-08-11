import type { ScoreDelta } from "../domain/value-objects/ScoreDelta.js";

/** Port: detects which scoring criteria fire for a given inbound message text. */
export interface ILeadScorer {
  score(messageText: string): ReadonlyArray<ScoreDelta>;
}
