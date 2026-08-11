import { ok, type Result } from "@aos/common";

import type { IAssignmentStrategy, StrategySelection } from "../contracts/IAssignmentStrategy.js";
import type { SalesHuman } from "../domain/entities/SalesHuman.js";
import type { NoAvailableSalesError } from "../domain/errors/index.js";
import { AssignmentMode } from "../domain/value-objects/AssignmentMode.js";
import type { BranchId } from "../domain/value-objects/BranchId.js";

/**
 * Manager-decides assignment mode: never auto-assigns. Always returns `{ kind: "PENDING" }`,
 * regardless of who's `ON`/available — the branch has opted out of automatic assignment entirely.
 *
 * Judgment call (scope boundary, documented per the task's resolution #5): the spec's prose says
 * "Manager assigns via dashboard → `ApproveAssignment` use case", but no such use case appears in
 * the folder tree or the Public API export list, and it would reference a future dashboard/
 * human-approval flow this package doesn't own. Treated as genuinely out of scope — this strategy
 * is a complete, self-sufficient contract on its own: it returns `PENDING`, and
 * `LeadAssignmentService` (not the strategy — see `IAssignmentStrategy`'s docstring on why
 * strategies stay side-effect-free) is what turns that into a `QueueService.enqueue` call plus a
 * `LeadQueued` event with `reason: "MANUAL"`. No `ApproveAssignment.ts` is built.
 */
export class ManualAssignStrategy implements IAssignmentStrategy {
  readonly mode = AssignmentMode.MANUAL;

  select(
    _branchId: BranchId,
    _sales: readonly SalesHuman[],
  ): Result<StrategySelection, NoAvailableSalesError> {
    return ok({ kind: "PENDING" });
  }
}
