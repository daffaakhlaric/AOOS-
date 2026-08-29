import { SalesHumanId } from "@aos/branch-manager";
import { err, ErrorCode, ok, type Result } from "@aos/common";
import { z } from "zod";

import type { IClosingRepository } from "../../contracts/IClosingRepository.js";
import type { ILeadRepository } from "../../contracts/ILeadRepository.js";
import { Closing } from "../../domain/entities/Closing.js";
import { LeadNotFoundError } from "../../domain/errors/LeadNotFoundError.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import type { LeadStoreEvents } from "../../domain/events/LeadStoreEvents.js";
import { ClosingId } from "../../domain/value-objects/ClosingId.js";
import { ClosingType } from "../../domain/value-objects/ClosingType.js";
import { LeadId } from "../../domain/value-objects/LeadId.js";

export interface RecordClosingInput {
  readonly leadId: string;
  readonly salesHumanId: string;
  readonly closingType: ClosingType;
  readonly unitId?: string;
  readonly unitModel?: string;
  readonly unitPrice?: number;
  readonly campaignId?: string;
  readonly adId?: string;
  readonly commissionIdr?: number;
  readonly commissionPct?: number;
  readonly notes?: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

const RecordClosingInputSchema = z.object({
  leadId: z.string().min(1),
  salesHumanId: z.string().min(1),
  closingType: z.nativeEnum(ClosingType),
  unitId: z.string().optional(),
  unitModel: z.string().optional(),
  unitPrice: z.number().nonnegative().optional(),
  campaignId: z.string().optional(),
  adId: z.string().optional(),
  commissionIdr: z.number().nonnegative().optional(),
  commissionPct: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  tenantId: z.string().min(1),
  correlationId: z.string().min(1),
});

/**
 * Called by a sales human via the CRM app. This is the ONLY way a lead's `status` becomes
 * `CLOSED` (design resolution #4 — `UpdateLeadStatus` explicitly rejects that target). Stores
 * campaign attribution + commission fields so Samantha (`@aos/meta-ads-agent`) can compute Rp/SPK
 * feed-back via `GetClosingStats`.
 */
export class RecordClosing {
  constructor(
    private readonly leadRepository: ILeadRepository,
    private readonly closingRepository: IClosingRepository,
    private readonly events: LeadStoreEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: RecordClosingInput): Promise<Result<Closing, LeadStoreError>> {
    const parsed = RecordClosingInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new LeadStoreError(`RecordClosing input validation failed: ${parsed.error.message}`, {
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

    const now = this.now();
    const closingResult = Closing.create({
      id: ClosingId.generate(),
      leadId: leadIdResult.value,
      salesHumanId: salesHumanIdResult.value,
      branchId: lead.branchId,
      closingType: parsed.data.closingType,
      unitId: parsed.data.unitId,
      unitModel: parsed.data.unitModel,
      unitPrice: parsed.data.unitPrice,
      campaignId: parsed.data.campaignId ?? lead.campaignId,
      adId: parsed.data.adId ?? lead.adId,
      commissionIdr: parsed.data.commissionIdr,
      commissionPct: parsed.data.commissionPct,
      notes: parsed.data.notes,
      testDriveAt: parsed.data.closingType === "TEST_DRIVE" ? now : undefined,
      spkAt: parsed.data.closingType === "SPK" ? now : undefined,
      createdAt: now,
    });
    /* v8 ignore start -- unitPrice/commissionIdr are already validated non-negative by the Zod
       schema above, so Closing.create's only 2 failure modes can never trigger here. */
    if (!closingResult.ok) {
      return err(
        new LeadStoreError(closingResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    /* v8 ignore stop */

    const insertResult = await this.closingRepository.insert(closingResult.value);
    if (!insertResult.ok) {
      return err(insertResult.error);
    }

    const updatedLead = lead.withClosed(now);
    const updateResult = await this.leadRepository.update(updatedLead);
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    await this.events.publishClosingRecorded({
      closingId: insertResult.value.id.toString(),
      leadId: leadIdResult.value.toString(),
      branchId: lead.branchId,
      closingType: parsed.data.closingType,
      campaignId: closingResult.value.campaignId,
      adId: closingResult.value.adId,
      commissionIdr: parsed.data.commissionIdr,
      tenantId: parsed.data.tenantId,
      correlationId: parsed.data.correlationId,
      occurredAt: now,
      version: "1.0",
    });

    return ok(insertResult.value);
  }
}
