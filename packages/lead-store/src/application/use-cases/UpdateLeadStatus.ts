import { err, ErrorCode, ok, type Result } from "@aos/common";

import type { ILeadRepository } from "../../contracts/ILeadRepository.js";
import type { Lead } from "../../domain/entities/Lead.js";
import { LeadNotFoundError } from "../../domain/errors/LeadNotFoundError.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import type { LeadStoreEvents } from "../../domain/events/LeadStoreEvents.js";
import { LeadId } from "../../domain/value-objects/LeadId.js";
import type { LeadStatus } from "../../domain/value-objects/LeadStatus.js";
import { transitionLeadStatus } from "../../domain/value-objects/LeadStatusTransition.js";

export interface UpdateLeadStatusInput {
  readonly leadId: string;
  readonly toStatus: LeadStatus;
  readonly tenantId: string;
  readonly correlationId: string;
}

/**
 * Free bidirectional transitions among `NEW | COLD | WARM | HOT`. Rejects `ASSIGNED`/`CLOSED` as
 * a target (those are only reachable via `RecordAssignment`/`RecordClosing`) and rejects ANY
 * transition once the lead is already `CLOSED` (terminal) — design resolution #4, enforced by the
 * explicit `transitionLeadStatus` state machine.
 */
export class UpdateLeadStatus {
  constructor(
    private readonly leadRepository: ILeadRepository,
    private readonly events: LeadStoreEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: UpdateLeadStatusInput): Promise<Result<Lead, LeadStoreError>> {
    const idResult = LeadId.create(input.leadId);
    if (!idResult.ok) {
      return err(new LeadStoreError(idResult.error.message, { code: ErrorCode.VALIDATION_ERROR }));
    }

    const findResult = await this.leadRepository.findById(idResult.value, input.tenantId);
    if (!findResult.ok) {
      return err(findResult.error);
    }
    if (findResult.value === undefined) {
      return err(new LeadNotFoundError(`Lead not found: ${input.leadId}`));
    }
    const lead = findResult.value;

    const transitionResult = transitionLeadStatus(lead.status, input.toStatus);
    if (!transitionResult.ok) {
      return err(transitionResult.error);
    }

    const fromStatus = lead.status;
    const now = this.now();
    const updated = lead.withStatus(transitionResult.value, now);

    const updateResult = await this.leadRepository.update(updated);
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    await this.events.publishLeadStatusChanged({
      leadId: updated.id.toString(),
      branchId: updated.branchId,
      fromStatus,
      toStatus: transitionResult.value,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      occurredAt: now,
      version: "1.0",
    });

    return ok(updateResult.value);
  }
}
