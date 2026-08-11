import { err, ok, type Result } from "@aos/common";

import type { IBranchRegistry } from "../../contracts/IBranchRegistry.js";
import type { ISalesTeamRegistry } from "../../contracts/ISalesTeamRegistry.js";
import type { BranchConfig } from "../../domain/entities/BranchConfig.js";
import type { SalesHuman } from "../../domain/entities/SalesHuman.js";
import type { BranchNotFoundError } from "../../domain/errors/index.js";
import type { BranchId } from "../../domain/value-objects/BranchId.js";
import type { QueueService } from "../services/QueueService.js";

export interface GetBranchStatusInput {
  readonly branchId: BranchId;
}

export interface BranchStatus {
  readonly branch: BranchConfig;
  readonly team: readonly SalesHuman[];
  readonly availableCount: number;
  readonly queueSize: number;
  readonly todayAssignedCount: number;
}

/** Full branch overview: team, queue size, and today's assignment stats. */
export class GetBranchStatus {
  constructor(
    private readonly branchRegistry: IBranchRegistry,
    private readonly salesTeamRegistry: ISalesTeamRegistry,
    private readonly queueService: QueueService,
  ) {}

  execute(input: GetBranchStatusInput): Result<BranchStatus, BranchNotFoundError> {
    const branchResult = this.branchRegistry.getByBranchId(input.branchId);
    if (!branchResult.ok) {
      return err(branchResult.error);
    }
    const team = this.salesTeamRegistry.getByBranch(input.branchId);
    const availableCount = team.filter((s) => s.isAvailable).length;
    const todayAssignedCount = team.reduce((sum, s) => sum + s.todayLeadCount.toNumber(), 0);
    const queueSize = this.queueService.getQueueSize(input.branchId);

    return ok({
      branch: branchResult.value,
      team,
      availableCount,
      queueSize,
      todayAssignedCount,
    });
  }
}
