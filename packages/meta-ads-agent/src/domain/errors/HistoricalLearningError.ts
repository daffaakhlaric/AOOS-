import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { AgentError } from "./AgentError.js";

/**
 * `HistoricalLearningService.learn()` could not complete — e.g. the underlying
 * `@aos/meta-ads-connector` `PullCampaignData` call failed. Mapped to `ErrorCode.UNAVAILABLE`,
 * mirroring `ExecutionError`: the request itself was valid; failure here means the upstream Meta
 * API data-pull channel could not complete — AAOS-W1D-S1S2 (S1).
 */
export class HistoricalLearningError extends AgentError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.UNAVAILABLE, message, options);
  }
}
