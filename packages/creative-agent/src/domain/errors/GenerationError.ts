import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { CreativeAgentError } from "./CreativeAgentError.js";

/**
 * A `CreativeOrchestratorService` failure severe enough to fail the whole `CreativePackage` —
 * per the spec's error-handling rules, this is reserved for TOTAL image generation failure (all
 * requested images failed) or a downstream `@aos/asset-library` persistence failure. A single
 * failed video, or 1-of-N failed images, is handled gracefully and never raises this error.
 */
export class GenerationError extends CreativeAgentError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.UNAVAILABLE, message, options);
  }
}
