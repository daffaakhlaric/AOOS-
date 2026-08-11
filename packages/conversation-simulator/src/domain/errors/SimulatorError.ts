import type { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package returns-as-a-value (always inside `Result.err`, never
 * thrown for an expected/recoverable failure — constitution §16 Error Handling Standards).
 * Extends `@aos/errors`' `AosError`, mirroring `@aos/sales-agent`'s `AgentError` /
 * `@aos/branch-manager`'s `BranchManagerError` convention exactly. `PersonaNotFoundError` and
 * `SimulationTimeoutError` (below) are the 2 more specific subclasses; `SimulatorError` itself is
 * used directly for generic simulation-orchestration failures (e.g. an unexpected `err` Result or
 * thrown exception surfacing from Jessy's own use cases — design resolution #2(d)) that don't fit
 * either narrower category.
 */
export class SimulatorError extends AosError {
  constructor(code: ErrorCode, message: string, options?: AosErrorOptions) {
    super(code, message, options);
  }
}
