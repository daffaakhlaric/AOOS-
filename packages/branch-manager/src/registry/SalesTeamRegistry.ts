import { err, ok, type Result } from "@aos/common";

import type { ISalesTeamRegistry } from "../contracts/ISalesTeamRegistry.js";
import type { SalesHuman } from "../domain/entities/SalesHuman.js";
import { SalesHumanNotFoundError } from "../domain/errors/index.js";
import type { BranchId } from "../domain/value-objects/BranchId.js";
import type { SalesHumanId } from "../domain/value-objects/SalesHumanId.js";

/** Registry Pattern — id-keyed sales-team membership, with per-branch lookup for assignment strategies. */
export class SalesTeamRegistry implements ISalesTeamRegistry {
  private readonly byId = new Map<string, SalesHuman>();

  add(salesHuman: SalesHuman): void {
    this.byId.set(salesHuman.id.toString(), salesHuman);
  }

  remove(id: SalesHumanId): Result<void, SalesHumanNotFoundError> {
    const key = id.toString();
    if (!this.byId.has(key)) {
      return err(new SalesHumanNotFoundError(`No sales human registered for id "${key}"`));
    }
    this.byId.delete(key);
    return ok(undefined);
  }

  getById(id: SalesHumanId): Result<SalesHuman, SalesHumanNotFoundError> {
    const salesHuman = this.byId.get(id.toString());
    if (salesHuman === undefined) {
      return err(
        new SalesHumanNotFoundError(`No sales human registered for id "${id.toString()}"`),
      );
    }
    return ok(salesHuman);
  }

  getByBranch(branchId: BranchId): readonly SalesHuman[] {
    return [...this.byId.values()].filter((s) => s.branchId === branchId);
  }

  getAvailable(branchId: BranchId): readonly SalesHuman[] {
    return this.getByBranch(branchId).filter((s) => s.isAvailable);
  }

  getAll(): readonly SalesHuman[] {
    return [...this.byId.values()];
  }

  update(salesHuman: SalesHuman): Result<SalesHuman, SalesHumanNotFoundError> {
    const key = salesHuman.id.toString();
    if (!this.byId.has(key)) {
      return err(new SalesHumanNotFoundError(`No sales human registered for id "${key}"`));
    }
    this.byId.set(key, salesHuman);
    return ok(salesHuman);
  }
}
