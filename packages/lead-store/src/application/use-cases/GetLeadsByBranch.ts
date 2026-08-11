import type { BranchId } from "@aos/branch-manager";
import type { Result } from "@aos/common";

import type { ILeadRepository } from "../../contracts/ILeadRepository.js";
import type { Lead } from "../../domain/entities/Lead.js";
import type { LeadStoreError } from "../../domain/errors/LeadStoreError.js";

/** Fetches every lead for one branch — powers the CRM dashboard's per-branch view. */
export class GetLeadsByBranch {
  constructor(private readonly leadRepository: ILeadRepository) {}

  async execute(branchId: BranchId): Promise<Result<readonly Lead[], LeadStoreError>> {
    return this.leadRepository.findByBranch(branchId);
  }
}
