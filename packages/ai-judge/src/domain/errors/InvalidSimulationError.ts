import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { JudgeError } from "./JudgeError.js";

/** Raised when a `SimulationResult` handed to `JudgeConversation`/`JudgeAllScenarios` is structurally unusable (e.g. no messages at all, so there is nothing to score). */
export class InvalidSimulationError extends JudgeError {
  constructor(reason: string, options: AosErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, `Cannot judge simulation: ${reason}`, options);
  }
}
