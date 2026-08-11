import type { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package returns-as-a-value (always inside `Result.err`, never
 * thrown for an expected/recoverable failure — constitution §16 Error Handling Standards).
 * Extends `@aos/errors`' `AosError`, mirroring `@aos/conversation-simulator`'s `SimulatorError` /
 * `@aos/sales-agent`'s `AgentError` convention exactly. `InvalidSimulationError` (below) is the
 * more specific subclass; `JudgeError` itself is used directly for generic scoring/config
 * failures that don't fit that narrower category.
 */
export class JudgeError extends AosError {
  constructor(code: ErrorCode, message: string, options?: AosErrorOptions) {
    super(code, message, options);
  }
}
