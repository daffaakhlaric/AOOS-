import { ok, type Result } from "@aos/common";

import type { ISalesTeamRegistry } from "../../contracts/ISalesTeamRegistry.js";
import type { SalesHuman } from "../../domain/entities/SalesHuman.js";
import type { BranchId } from "../../domain/value-objects/BranchId.js";

export interface GetAvailableSalesInput {
  readonly branchId: BranchId;
}

/** Returns every currently-available (`ON` + under-quota) sales human for a branch. */
export class GetAvailableSales {
  constructor(private readonly salesTeamRegistry: ISalesTeamRegistry) {}

  execute(input: GetAvailableSalesInput): Result<readonly SalesHuman[], never> {
    return ok(this.salesTeamRegistry.getAvailable(input.branchId));
  }
}
