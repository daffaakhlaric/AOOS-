import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { BranchManagerError } from "./BranchManagerError.js";

/**
 * Generic assignment/queue-pipeline failure that doesn't warrant its own error class: primarily a
 * full queue (`QueueService`'s `maxQueueSize` enforcement), and any other assignment-pipeline
 * wiring failure that isn't specifically a not-found or unavailability condition.
 *
 * Judgment call: the spec doesn't name a dedicated error for `QueueService`'s `maxQueueSize`
 * enforcement. Rather than introduce a 6th error class beyond the 5 the spec's folder tree lists,
 * `AssignmentError` (`ErrorCode.CONFLICT`) is reused for "queue is full" — a queue-capacity clash
 * is a conflict between the incoming lead and existing queue state, which `ErrorCode.CONFLICT`
 * models accurately without adding scope the spec didn't ask for.
 */
export class AssignmentError extends BranchManagerError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.CONFLICT, message, options);
  }
}
