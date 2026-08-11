import type { AssignmentMode } from "@aos/branch-manager";

/** Payload for `aaos.lead-store.lead.assigned`, emitted whenever `RecordAssignment` successfully persists an assignment. */
export interface LeadAssigned {
  readonly assignmentId: string;
  readonly leadId: string;
  readonly branchId: string;
  readonly salesHumanId: string;
  readonly assignmentMode: AssignmentMode;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
