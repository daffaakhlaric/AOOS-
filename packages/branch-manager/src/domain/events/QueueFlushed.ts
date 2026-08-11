import type { BranchId } from "../value-objects/BranchId.js";

/** Payload for `aaos.branch.queue.flushed`, emitted whenever `QueueService.flushBranch` processes a branch's queue after a sales human comes back `ON`. Pinned shape (spec's `queue_flush` example): `{ assigned: N, remaining: M }`. */
export interface QueueFlushed {
  readonly branchId: BranchId;
  readonly assigned: number;
  readonly remaining: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
