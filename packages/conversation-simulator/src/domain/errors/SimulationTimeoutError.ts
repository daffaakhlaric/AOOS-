import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { SimulatorError } from "./SimulatorError.js";

/**
 * Raised only when a simulation's wall-clock budget (`SimulatorConfig.maxDurationMs`) is exceeded
 * mid-run — a distinct failure mode from `SimulationStatus.TIMEOUT` (which means "ran out of
 * *turns*, not wall-clock time" and is a normal, `ok` outcome, not an error).
 */
export class SimulationTimeoutError extends SimulatorError {
  constructor(budgetMs: number, elapsedMs: number, options: AosErrorOptions = {}) {
    super(
      ErrorCode.TIMEOUT,
      `Simulation exceeded its ${budgetMs}ms wall-clock budget (elapsed ${elapsedMs}ms)`,
      options,
    );
  }
}
