import type { Result } from "@aos/common";

import type { ISalesTeamRegistry } from "../../contracts/ISalesTeamRegistry.js";
import type { AssignmentError } from "../../domain/errors/index.js";
import type { BranchId } from "../../domain/value-objects/BranchId.js";
import type { QueueFlushResult, QueueService } from "../services/QueueService.js";

export interface FlushQueueInput {
  readonly branchId: BranchId;
  readonly tenantId: string;
  readonly correlationId: string;
}

/**
 * Processes a branch's queued leads up to its currently-available capacity (spec: "1. Sales
 * status changes to ON 2. Check queue for that branch 3. Assign queued leads (up to capacity)
 * 4. Emit QueueFlushed 5. Notify manager via event if queue still has items" — step 5 is covered
 * by `QueueFlushed.remaining > 0`, which any subscriber — e.g. a future manager-notification
 * consumer — can act on; this package's job stops at emitting the event with an accurate count).
 *
 * Capacity is computed here (not inside `QueueService`) as the sum of `capacityRemaining` across
 * the branch's currently-`isAvailable` sales humans — i.e. "how many more leads could this branch
 * actually absorb right now."
 */
export class FlushQueue {
  constructor(
    private readonly salesTeamRegistry: ISalesTeamRegistry,
    private readonly queueService: QueueService,
  ) {}

  async execute(input: FlushQueueInput): Promise<Result<QueueFlushResult, AssignmentError>> {
    const available = this.salesTeamRegistry.getAvailable(input.branchId);
    const capacity = available.reduce((sum, s) => sum + s.capacityRemaining, 0);
    return this.queueService.flushBranch(input.branchId, capacity, {
      tenantId: input.tenantId,
      correlationId: input.correlationId,
    });
  }
}
