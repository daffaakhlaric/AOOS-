import type { SalesHumanId } from "@aos/branch-manager";
import type { Result } from "@aos/common";

import type { ILeadRepository } from "../../contracts/ILeadRepository.js";
import type { Lead } from "../../domain/entities/Lead.js";
import type { LeadStoreError } from "../../domain/errors/LeadStoreError.js";

/** Fetches every lead assigned to one sales human — powers the sales human's personal queue view. */
export class GetLeadsBySales {
  constructor(private readonly leadRepository: ILeadRepository) {}

  async execute(salesHumanId: SalesHumanId): Promise<Result<readonly Lead[], LeadStoreError>> {
    return this.leadRepository.findBySales(salesHumanId);
  }
}
