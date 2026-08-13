import type { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package returns-as-a-value (always inside `Result.err`, never
 * thrown for an expected/recoverable failure). Extends `@aos/errors`' `AosError` — the same
 * pattern `@aos/sales-agent`'s `AgentError` and `@aos/ai-judge`'s `JudgeError` establish.
 * `BriefValidationError`, `GenerationError`, and `NoSourcePhotosError` (siblings in this
 * directory) are the 3 more specific subclasses; `CreativeAgentError` itself is used directly for
 * generic orchestration failures that don't fit any of the 3 narrower categories.
 */
export class CreativeAgentError extends AosError {
  constructor(code: ErrorCode, message: string, options?: AosErrorOptions) {
    super(code, message, options);
  }
}
