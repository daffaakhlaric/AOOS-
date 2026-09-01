import { err, ErrorCode, type Result } from "@aos/common";

import type { ILeadRepository } from "../../contracts/ILeadRepository.js";
import type { Lead } from "../../domain/entities/Lead.js";
import { LeadNotFoundError } from "../../domain/errors/LeadNotFoundError.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import { LeadId } from "../../domain/value-objects/LeadId.js";

export interface MarkLeadSyncedToMetaAudienceInput {
  readonly leadId: string;
  /** PROPERTY-TENANT-ISOLATION Phase 1: `findById` now requires a real `tenantId` — the caller
   * (`LookalikeService.syncHotLeadsToMeta`) already resolves one real tenant per run via its own
   * `this.tenantId`, so this is threaded through rather than falling back to anything static. */
  readonly tenantId: string;
}

/**
 * AAOS-ABTESTING-LOOKALIKE Part 2: marks one HOT lead as having just had its phone number
 * uploaded (SHA256-hashed) into the tenant's Meta Custom Audience — `LookalikeService.
 * syncHotLeadsToMeta`'s per-lead bookkeeping call, mirroring `UpdateLeadStatus`'s find-then-update
 * shape without a status-machine transition (this is a pure flag flip, not a lead lifecycle move).
 */
export class MarkLeadSyncedToMetaAudience {
  constructor(
    private readonly leadRepository: ILeadRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: MarkLeadSyncedToMetaAudienceInput): Promise<Result<Lead, LeadStoreError>> {
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

    const updated = findResult.value.withSyncedToMetaAudience(this.now());
    return this.leadRepository.update(updated);
  }
}
