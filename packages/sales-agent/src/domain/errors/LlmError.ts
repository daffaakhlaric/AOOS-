import type { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { AgentError } from "./AgentError.js";

/**
 * An OpenAI-backed reply generation attempt failed — a missing/empty API key, a network/timeout
 * failure reaching OpenAI, a non-2xx HTTP response, or a malformed/empty completion body.
 * `LlmResponseGenerator` catches every `LlmError` and falls back to the real, unmodified,
 * rule-based `ResponseGenerator` for that one message — a real lead must never go unreplied-to or
 * receive something malformed because OpenAI had a bad moment (coordinator note #3).
 */
export class LlmError extends AgentError {
  constructor(code: ErrorCode, message: string, options?: AosErrorOptions) {
    super(code, message, options);
  }
}
