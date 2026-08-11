import type { ILeadScorer } from "../contracts/ILeadScorer.js";
import type { ScoreDelta } from "../domain/value-objects/ScoreDelta.js";

import { ScoreCalculator } from "./ScoreCalculator.js";

/** The main scoring engine (spec "scoring/LeadScorer.ts") — a thin `ILeadScorer` adapter over the pure `ScoreCalculator` math. */
export class LeadScorer implements ILeadScorer {
  score(messageText: string): ReadonlyArray<ScoreDelta> {
    return ScoreCalculator.calculate(messageText);
  }
}
