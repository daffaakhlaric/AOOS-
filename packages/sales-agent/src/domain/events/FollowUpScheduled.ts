import type { BranchId } from "../value-objects/BranchId.js";
import type { LeadTemperature } from "../value-objects/LeadTemperature.js";

/** Payload for `aaos.sales.follow-up.scheduled`, emitted after `FollowUpService` builds a `FollowUpSchedule` for a COLD/WARM lead. */
export interface FollowUpScheduled {
  readonly leadPhone: string;
  readonly branchId: BranchId;
  readonly temperature: LeadTemperature;
  readonly days: ReadonlyArray<number>;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
