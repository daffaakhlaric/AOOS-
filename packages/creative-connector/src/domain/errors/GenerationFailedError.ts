import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { CreativeConnectorError } from "./CreativeConnectorError.js";

/**
 * Kie AI itself reported a failed generation — `successFlag` 2 ("failed") or 3 ("generation
 * failed"). Per design resolution #4, both `SuccessFlag.FAILED` and `SuccessFlag.GEN_FAILED`
 * route here identically; the two `successFlag` values are kept distinct at the `SuccessFlag`
 * value-object level (for API fidelity) but collapse to the same error type once they cross the
 * polling boundary, since callers have no different remedy for either. Always
 * `ErrorCode.UNAVAILABLE` — the failure originates from the remote Kie AI generation pipeline, not
 * from a bad input already validated and accepted by this package.
 */
export class GenerationFailedError extends CreativeConnectorError {
  public readonly successFlag: number | undefined;

  constructor(message: string, options: AosErrorOptions & { successFlag?: number } = {}) {
    super(ErrorCode.UNAVAILABLE, message, options);
    this.successFlag = options.successFlag;
  }
}
