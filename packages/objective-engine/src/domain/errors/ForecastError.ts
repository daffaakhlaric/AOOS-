import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { ObjectiveError } from "./ObjectiveError.js";

/**
 * `ForecastObjective` could not produce a forecast. Judgment call (per the spec's "closest
 * fitting generic code, document your choice"): mapped to `ErrorCode.INTERNAL` rather than
 * `VALIDATION_ERROR` — `VALIDATION_ERROR` is reserved for `InvalidObjectiveError` (bad
 * caller-supplied input), while `ForecastError` represents "the forecast computation itself
 * could not reach a valid result" for an otherwise well-formed request (e.g. the underlying
 * `AdAccount`/progress state is internally inconsistent). A missing `Objective` still surfaces
 * as `ObjectiveNotFoundError`, not `ForecastError` — this class is reserved for computation
 * failures downstream of a successful lookup.
 */
export class ForecastError extends ObjectiveError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.INTERNAL, message, options);
  }
}
