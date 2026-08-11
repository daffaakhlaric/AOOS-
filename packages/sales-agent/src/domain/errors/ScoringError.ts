import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { AgentError } from "./AgentError.js";

/** A `LeadScorer`/`ScoreCalculator`/`LeadScoringService` failure (invalid `LeadScore` construction, invalid `ScoreDelta`). */
export class ScoringError extends AgentError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}
