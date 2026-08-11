import { err, ok, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import { SalesHumanBuilder } from "../../builders/SalesHumanBuilder.js";
import type { IBranchRegistry } from "../../contracts/IBranchRegistry.js";
import type { ISalesTeamRegistry } from "../../contracts/ISalesTeamRegistry.js";
import type { SalesHuman } from "../../domain/entities/SalesHuman.js";
import type { BranchNotFoundError } from "../../domain/errors/index.js";
import type { BranchId } from "../../domain/value-objects/BranchId.js";
import type { SalesStatus } from "../../domain/value-objects/SalesStatus.js";

export interface AddSalesHumanInput {
  readonly name: string;
  readonly waNumber: string;
  readonly branchId: BranchId;
  readonly status?: SalesStatus;
  readonly maxLeadsPerDay?: number;
  readonly joinedAt?: Date;
}

/** Registers a new sales human to a branch's team — validates the branch exists first. */
export class AddSalesHuman {
  constructor(
    private readonly branchRegistry: IBranchRegistry,
    private readonly salesTeamRegistry: ISalesTeamRegistry,
  ) {}

  execute(input: AddSalesHumanInput): Result<SalesHuman, BranchNotFoundError | ValidationError> {
    const branchResult = this.branchRegistry.getByBranchId(input.branchId);
    if (!branchResult.ok) {
      return err(branchResult.error);
    }

    const builder = new SalesHumanBuilder()
      .withName(input.name)
      .withWaNumber(input.waNumber)
      .withBranchId(input.branchId);
    if (input.status !== undefined) {
      builder.withStatus(input.status);
    }
    if (input.maxLeadsPerDay !== undefined) {
      builder.withMaxLeadsPerDay(input.maxLeadsPerDay);
    }
    if (input.joinedAt !== undefined) {
      builder.withJoinedAt(input.joinedAt);
    }

    const result = builder.build();
    if (!result.ok) {
      return err(result.error);
    }
    this.salesTeamRegistry.add(result.value);
    return ok(result.value);
  }
}
