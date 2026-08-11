import type { AssignmentMode } from "../value-objects/AssignmentMode.js";
import type { BranchId } from "../value-objects/BranchId.js";

/** Payload for `aaos.branch.lead.assigned`, emitted whenever `LeadAssignmentService` successfully assigns a lead to a sales human. */
export interface LeadAssigned {
  readonly assignmentId: string;
  readonly leadId: string;
  readonly branchId: BranchId;
  readonly salesHumanId: string;
  readonly assignmentMode: AssignmentMode;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
