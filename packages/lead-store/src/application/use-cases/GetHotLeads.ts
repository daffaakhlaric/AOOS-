import type { BranchId } from "@aos/branch-manager";
import type { Result } from "@aos/common";

import type { ILeadRepository } from "../../contracts/ILeadRepository.js";
import type { Lead } from "../../domain/entities/Lead.js";
import type { LeadStoreError } from "../../domain/errors/LeadStoreError.js";

/** Fetches every `status=HOT` lead for one branch, ordered by `becameHotAt` DESC (spec pin). */
export class GetHotLeads {
  constructor(private readonly leadRepository: ILeadRepository) {}

  async execute(branchId: BranchId): Promise<Result<readonly Lead[], LeadStoreError>> {
    const result = await this.leadRepository.findHotByBranch(branchId);
    if (!result.ok) {
      return result;
    }
    const sorted = [...result.value].sort((a, b) => {
      const aTime = a.becameHotAt?.getTime() ?? 0;
      const bTime = b.becameHotAt?.getTime() ?? 0;
      return bTime - aTime;
    });
    return { ok: true, value: sorted };
  }
}
