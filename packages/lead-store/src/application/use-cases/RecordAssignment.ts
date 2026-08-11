import { AssignmentMode, BranchId, SalesHumanId } from "@aos/branch-manager";
import { err, ErrorCode, ok, type Result } from "@aos/common";
import { z } from "zod";

import type { IAssignmentRepository } from "../../contracts/IAssignmentRepository.js";
import type { ILeadRepository } from "../../contracts/ILeadRepository.js";
import { Assignment } from "../../domain/entities/Assignment.js";
import { LeadNotFoundError } from "../../domain/errors/LeadNotFoundError.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import type { LeadStoreEvents } from "../../domain/events/LeadStoreEvents.js";
import { AssignmentId } from "../../domain/value-objects/AssignmentId.js";
import { LeadId } from "../../domain/value-objects/LeadId.js";
import { LeadStatus } from "../../domain/value-objects/LeadStatus.js";

export interface RecordAssignmentInput {
  readonly leadId: string;
  readonly salesHumanId: string;
  readonly assignmentMode: AssignmentMode;
  readonly branchId: BranchId;
  readonly tenantId: string;
  readonly correlationId: string;
}

const RecordAssignmentInputSchema = z.object({
  leadId: z.string().min(1),
  salesHumanId: z.string().min(1),
  assignmentMode: z.nativeEnum(AssignmentMode),
  branchId: z.nativeEnum(BranchId),
  tenantId: z.string().min(1),
  correlationId: z.string().min(1),
});

/**
 * Called by `@aos/branch-manager` after it decides an assignment. This is the ONLY way a lead's
 * `status` becomes `ASSIGNED` (design resolution #4 — `UpdateLeadStatus` explicitly rejects that
 * target). Rejects assigning an already-`CLOSED` lead (a closed deal has nothing left to assign).
 */
export class RecordAssignment {
  constructor(
    private readonly leadRepository: ILeadRepository,
    private readonly assignmentRepository: IAssignmentRepository,
    private readonly events: LeadStoreEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: RecordAssignmentInput): Promise<Result<Assignment, LeadStoreError>> {
    const parsed = RecordAssignmentInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new LeadStoreError(`RecordAssignment input validation failed: ${parsed.error.message}`, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }

    const leadIdResult = LeadId.create(parsed.data.leadId);
    if (!leadIdResult.ok) {
      return err(
        new LeadStoreError(leadIdResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    const salesHumanIdResult = SalesHumanId.create(parsed.data.salesHumanId);
    if (!salesHumanIdResult.ok) {
      return err(
        new LeadStoreError(salesHumanIdResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }

    const findResult = await this.leadRepository.findById(leadIdResult.value);
    if (!findResult.ok) {
      return err(findResult.error);
    }
    if (findResult.value === undefined) {
      return err(new LeadNotFoundError(`Lead not found: ${parsed.data.leadId}`));
    }
    const lead = findResult.value;
    if (lead.status === LeadStatus.CLOSED) {
      return err(new LeadStoreError(`Cannot assign an already-CLOSED lead: ${parsed.data.leadId}`));
    }

    const now = this.now();
    const assignmentResult = Assignment.create({
      id: AssignmentId.generate(),
      leadId: leadIdResult.value,
      branchId: parsed.data.branchId,
      salesHumanId: salesHumanIdResult.value,
      assignmentMode: parsed.data.assignmentMode,
      assignedAt: now,
      status: "ACTIVE",
    });
    /* v8 ignore start -- assignmentMode is already validated by the Zod schema above (nativeEnum),
       so Assignment.create's only failure mode can never trigger here. */
    if (!assignmentResult.ok) {
      return err(
        new LeadStoreError(assignmentResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    /* v8 ignore stop */

    const insertResult = await this.assignmentRepository.insert(assignmentResult.value);
    if (!insertResult.ok) {
      return err(insertResult.error);
    }

    const updatedLead = lead.withAssignment(
      salesHumanIdResult.value,
      parsed.data.assignmentMode,
      now,
    );
    const updateResult = await this.leadRepository.update(updatedLead);
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    await this.events.publishLeadAssigned({
      assignmentId: insertResult.value.id.toString(),
      leadId: leadIdResult.value.toString(),
      branchId: parsed.data.branchId,
      salesHumanId: salesHumanIdResult.value.toString(),
      assignmentMode: parsed.data.assignmentMode,
      tenantId: parsed.data.tenantId,
      correlationId: parsed.data.correlationId,
      occurredAt: now,
      version: "1.0",
    });

    return ok(insertResult.value);
  }
}
