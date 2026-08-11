import type { BranchId, SalesHumanId } from "@aos/branch-manager";
import type { Result } from "@aos/common";

import type { Lead } from "../domain/entities/Lead.js";
import type { SupabaseError } from "../domain/errors/SupabaseError.js";
import type { LeadId } from "../domain/value-objects/LeadId.js";

export type { LeadId } from "../domain/value-objects/LeadId.js";

/** Repository contract for `leads` — Supabase is the only real implementation (`infrastructure/supabase/LeadRepository.ts`); tests inject a hand-rolled mock. */
export interface ILeadRepository {
  findById(id: LeadId): Promise<Result<Lead | undefined, SupabaseError>>;
  findByPhoneAndBranch(
    leadPhone: string,
    branchId: BranchId,
  ): Promise<Result<Lead | undefined, SupabaseError>>;
  insert(lead: Lead): Promise<Result<Lead, SupabaseError>>;
  update(lead: Lead): Promise<Result<Lead, SupabaseError>>;
  findByBranch(branchId: BranchId): Promise<Result<readonly Lead[], SupabaseError>>;
  findHotByBranch(branchId: BranchId): Promise<Result<readonly Lead[], SupabaseError>>;
  findBySales(salesHumanId: SalesHumanId): Promise<Result<readonly Lead[], SupabaseError>>;
}
