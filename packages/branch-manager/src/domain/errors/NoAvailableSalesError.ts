import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { BranchManagerError } from "./BranchManagerError.js";

/** Every sales human for a branch is unavailable (`OFF`/`BUSY`, or at daily quota) — the trigger for `LeadAssignmentService` to fall back to `QueueService.enqueue`. Raised by `SmartAssignStrategy`/`RoundRobinStrategy` only (`ManualAssignStrategy` never raises this — it always returns `AssignmentPending`). */
export class NoAvailableSalesError extends BranchManagerError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.UNAVAILABLE, message, options);
  }
}
