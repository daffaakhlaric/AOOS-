import { err, ok, type Result } from "@aos/common";

import type { IAssignmentStrategy, StrategySelection } from "../contracts/IAssignmentStrategy.js";
import type { SalesHuman } from "../domain/entities/SalesHuman.js";
import { NoAvailableSalesError } from "../domain/errors/index.js";
import { AssignmentMode } from "../domain/value-objects/AssignmentMode.js";
import type { BranchId } from "../domain/value-objects/BranchId.js";

/**
 * Default assignment strategy: picks the available sales human with the fewest currently-open
 * leads (spec: filter `status === ON`, filter `todayLeadCount < maxLeadsPerDay` — both covered by
 * `SalesHuman.isAvailable` — sort `activeLeadCount` ascending, pick first).
 *
 * Tie-break rule (spec's own pinned test only covers the no-tie case, so this is a documented
 * judgment call): when two or more available sales humans share the same lowest `activeLeadCount`,
 * the one with the *earliest* `joinedAt` wins. `Array.prototype.sort` is a stable sort in every
 * JS engine ES2019+ targets, so ties that also share the same `joinedAt` fall back to original
 * registry order — but `joinedAt` is the primary, deterministic, documented tie-break signal.
 */
export class SmartAssignStrategy implements IAssignmentStrategy {
  readonly mode = AssignmentMode.SMART_ASSIGN;

  select(
    branchId: BranchId,
    sales: readonly SalesHuman[],
  ): Result<StrategySelection, NoAvailableSalesError> {
    const available = sales.filter((s) => s.isAvailable);
    if (available.length === 0) {
      return err(
        new NoAvailableSalesError(
          `No available sales human for branch "${branchId}" (SMART_ASSIGN)`,
        ),
      );
    }
    const sorted = [...available].sort((a, b) => {
      const byActive = a.activeLeadCount.toNumber() - b.activeLeadCount.toNumber();
      if (byActive !== 0) {
        return byActive;
      }
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });
    return ok({ kind: "ASSIGNED", salesHuman: sorted[0]! });
  }
}
