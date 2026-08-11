import type { BranchId } from "../value-objects/BranchId.js";

/** Why a lead landed in the queue instead of being assigned immediately. */
export type LeadQueuedReason = "NO_AVAILABLE_SALES" | "MANUAL";

/** Payload for `aaos.branch.lead.queued`, emitted whenever `LeadAssignmentService` cannot assign a lead immediately (all sales unavailable, or the branch's mode is `MANUAL`). */
export interface LeadQueued {
  readonly leadId: string;
  readonly branchId: BranchId;
  readonly reason: LeadQueuedReason;
  readonly queuePosition: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
