import type { Result } from "@aos/common";

import type { SalesHuman } from "../domain/entities/SalesHuman.js";
import type { SalesHumanNotFoundError } from "../domain/errors/index.js";
import type { BranchId } from "../domain/value-objects/BranchId.js";
import type { SalesHumanId } from "../domain/value-objects/SalesHumanId.js";

/** Registry Pattern port for the sales team, per branch. */
export interface ISalesTeamRegistry {
  /** Upsert by `SalesHumanId` — adding never fails validation (the `SalesHuman` is already a validated entity by construction). */
  add(salesHuman: SalesHuman): void;
  remove(id: SalesHumanId): Result<void, SalesHumanNotFoundError>;
  getById(id: SalesHumanId): Result<SalesHuman, SalesHumanNotFoundError>;
  getByBranch(branchId: BranchId): readonly SalesHuman[];
  /** Only `isAvailable` sales humans (`status === ON && todayLeadCount < maxLeadsPerDay`) for the branch, in registration order. */
  getAvailable(branchId: BranchId): readonly SalesHuman[];
  getAll(): readonly SalesHuman[];
  update(salesHuman: SalesHuman): Result<SalesHuman, SalesHumanNotFoundError>;
}
