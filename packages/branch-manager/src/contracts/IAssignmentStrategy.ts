import type { Result } from "@aos/common";

import type { SalesHuman } from "../domain/entities/SalesHuman.js";
import type { NoAvailableSalesError } from "../domain/errors/index.js";
import type { AssignmentMode } from "../domain/value-objects/AssignmentMode.js";
import type { BranchId } from "../domain/value-objects/BranchId.js";

/** A concrete assignment produced by a strategy. */
export interface StrategyAssigned {
  readonly kind: "ASSIGNED";
  readonly salesHuman: SalesHuman;
}

/** No concrete assignment yet — a human manager must decide (`ManualAssignStrategy`'s sole outcome). */
export interface StrategyPending {
  readonly kind: "PENDING";
}

export type StrategySelection = StrategyAssigned | StrategyPending;

/**
 * Strategy Pattern port — `SmartAssignStrategy` / `RoundRobinStrategy` / `ManualAssignStrategy`
 * each implement this, resolved by `LeadAssignmentService` via `BranchConfig.assignmentMode`
 * (real dispatch through a `Record<AssignmentMode, IAssignmentStrategy>`, never an if/else chain).
 *
 * Strategies are pure/side-effect-free by design: they never call an event publisher themselves
 * (see `ManualAssignStrategy`'s docstring for why) — `LeadAssignmentService` is the single place
 * that interprets a strategy's outcome and performs I/O (registry updates, event publishing).
 */
export interface IAssignmentStrategy {
  readonly mode: AssignmentMode;
  /** `sales` is every sales human registered to the branch (not pre-filtered) — the strategy applies its own availability filter. */
  select(
    branchId: BranchId,
    sales: readonly SalesHuman[],
  ): Result<StrategySelection, NoAvailableSalesError>;
}
