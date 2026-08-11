import { ok, type Result } from "@aos/common";

import type { QueuedLead } from "../../domain/entities/AssignmentQueue.js";
import type { BranchId } from "../../domain/value-objects/BranchId.js";
import type { QueueService } from "../services/QueueService.js";

export interface GetAssignmentQueueInput {
  readonly branchId: BranchId;
}

/** Returns a branch's currently-queued leads, in FIFO order. */
export class GetAssignmentQueue {
  constructor(private readonly queueService: QueueService) {}

  execute(input: GetAssignmentQueueInput): Result<readonly QueuedLead[], never> {
    return ok(this.queueService.getBranchQueue(input.branchId));
  }
}
