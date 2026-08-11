import { err, ErrorCode, ok, type Result } from "@aos/common";

import type { ILeadRepository } from "../../contracts/ILeadRepository.js";
import type { Lead } from "../../domain/entities/Lead.js";
import { LeadNotFoundError } from "../../domain/errors/LeadNotFoundError.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import { LeadId } from "../../domain/value-objects/LeadId.js";

/** Fetches a single lead by id. */
export class GetLead {
  constructor(private readonly leadRepository: ILeadRepository) {}

  async execute(leadId: string): Promise<Result<Lead, LeadStoreError>> {
    const idResult = LeadId.create(leadId);
    if (!idResult.ok) {
      return err(new LeadStoreError(idResult.error.message, { code: ErrorCode.VALIDATION_ERROR }));
    }
    const findResult = await this.leadRepository.findById(idResult.value);
    if (!findResult.ok) {
      return err(findResult.error);
    }
    if (findResult.value === undefined) {
      return err(new LeadNotFoundError(`Lead not found: ${leadId}`));
    }
    return ok(findResult.value);
  }
}
