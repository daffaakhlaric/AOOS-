import { err, ok, type Result } from "@aos/common";

import type { IAssignmentStrategy, StrategySelection } from "../contracts/IAssignmentStrategy.js";
import type { SalesHuman } from "../domain/entities/SalesHuman.js";
import { NoAvailableSalesError } from "../domain/errors/index.js";
import { AssignmentMode } from "../domain/value-objects/AssignmentMode.js";
import type { BranchId } from "../domain/value-objects/BranchId.js";

/**
 * Rotates evenly among a branch's currently-available (`ON` + under-quota) sales team.
 *
 * State: `lastAssignedIndex` is tracked per branch, on the strategy instance itself (a
 * branch-keyed `Map`) — this strategy is stateful by design (unlike `SmartAssignStrategy`/
 * `ManualAssignStrategy`), so `LeadAssignmentService` must resolve one shared instance per branch
 * mode, not construct a fresh one per call.
 *
 * The rotation always recomputes the *currently*-available subset on every call (never caches a
 * roster), so a sales human who goes `OFF` between assignments is transparently skipped — the
 * index tracks a position within "however many are available right now", not a specific person.
 * This matches the spec's pinned example exactly: sales `[A, B, C]` all `ON`, 4 assignments in a
 * row → `A, B, C, A` (index sequence `-1 → 0 → 1 → 2 → 0`, wrapping via modulo).
 */
export class RoundRobinStrategy implements IAssignmentStrategy {
  readonly mode = AssignmentMode.ROUND_ROBIN;
  private readonly lastAssignedIndex = new Map<BranchId, number>();

  select(
    branchId: BranchId,
    sales: readonly SalesHuman[],
  ): Result<StrategySelection, NoAvailableSalesError> {
    const available = sales.filter((s) => s.isAvailable);
    if (available.length === 0) {
      return err(
        new NoAvailableSalesError(
          `No available sales human for branch "${branchId}" (ROUND_ROBIN)`,
        ),
      );
    }
    const lastIndex = this.lastAssignedIndex.get(branchId) ?? -1;
    const nextIndex = (lastIndex + 1) % available.length;
    this.lastAssignedIndex.set(branchId, nextIndex);
    return ok({ kind: "ASSIGNED", salesHuman: available[nextIndex]! });
  }
}
