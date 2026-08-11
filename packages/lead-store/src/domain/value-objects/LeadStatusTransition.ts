import { err, ok, type Result } from "@aos/common";

import { LeadStoreError } from "../errors/LeadStoreError.js";

import { isPreAssignmentStatus, LeadStatus } from "./LeadStatus.js";

/**
 * The explicit, testable state machine for `UpdateLeadStatus` (design resolution #4 — written
 * as a single component rather than scattered ad hoc checks, per the task's instructions).
 *
 * Rules:
 * - `CLOSED` is terminal: ANY transition attempted from `CLOSED` is rejected (including to
 *   another temperature bucket, or a no-op back to `CLOSED`).
 * - `ASSIGNED` and `CLOSED` are NOT reachable via this state machine — only via the dedicated
 *   `RecordAssignment`/`RecordClosing` use cases, which write `leads.status` directly through the
 *   repository rather than through `transition()`.
 * - Among `NEW | COLD | WARM | HOT`, every transition (including no-ops) is free — temperature can
 *   move up or down freely as the lead's score changes.
 * - A lead currently `ASSIGNED` may move back to `NEW | COLD | WARM | HOT` (e.g. an assignment was
 *   released) but never directly to `CLOSED` — only `RecordClosing` closes a lead.
 */
export function transitionLeadStatus(
  from: LeadStatus,
  to: LeadStatus,
): Result<LeadStatus, LeadStoreError> {
  if (from === LeadStatus.CLOSED) {
    return err(
      new LeadStoreError(`Cannot transition lead status: "${from}" is terminal (lead is CLOSED)`),
    );
  }
  if (to === LeadStatus.ASSIGNED) {
    return err(
      new LeadStoreError(
        'Cannot transition lead status to "ASSIGNED" via UpdateLeadStatus — use RecordAssignment',
      ),
    );
  }
  if (to === LeadStatus.CLOSED) {
    return err(
      new LeadStoreError(
        'Cannot transition lead status to "CLOSED" via UpdateLeadStatus — use RecordClosing',
      ),
    );
  }
  // Unreachable given the enum's 6 members and the two explicit checks above, but kept as an
  // exhaustive guard so a future LeadStatus member cannot silently bypass this state machine.
  /* v8 ignore next 5 */
  if (!isPreAssignmentStatus(to)) {
    return err(new LeadStoreError(`Invalid lead status transition target: "${String(to)}"`));
  }
  return ok(to);
}
