import type { BranchId, SalesHumanId } from "@aos/branch-manager";
import type { Result } from "@aos/common";

import type { Lead } from "../domain/entities/Lead.js";
import type { SupabaseError } from "../domain/errors/SupabaseError.js";
import type { LeadId } from "../domain/value-objects/LeadId.js";

export type { LeadId } from "../domain/value-objects/LeadId.js";

/**
 * Repository contract for `leads` — Supabase is the only real implementation
 * (`infrastructure/supabase/LeadRepository.ts`); tests inject a hand-rolled mock.
 *
 * Every real query method takes a required `tenantId` (Multi-Tenant Phase 1B finding #3):
 * `BranchId` is a small, fixed, tenant-agnostic enum, so filtering by `branchId`/`salesHumanId`/
 * phone alone would let two different tenants using the same branch name see each other's leads.
 * `findById`/`insert`/`update` need no `tenantId` parameter — `Lead` already carries `tenantId` on
 * every instance, and `findById` looks up by the globally-unique primary key.
 */
export interface ILeadRepository {
  findById(id: LeadId): Promise<Result<Lead | undefined, SupabaseError>>;
  findByPhoneAndBranch(
    leadPhone: string,
    branchId: BranchId,
    tenantId: string,
  ): Promise<Result<Lead | undefined, SupabaseError>>;
  insert(lead: Lead): Promise<Result<Lead, SupabaseError>>;
  update(lead: Lead): Promise<Result<Lead, SupabaseError>>;
  findByBranch(
    branchId: BranchId,
    tenantId: string,
  ): Promise<Result<readonly Lead[], SupabaseError>>;
  findHotByBranch(
    branchId: BranchId,
    tenantId: string,
  ): Promise<Result<readonly Lead[], SupabaseError>>;
  findBySales(
    salesHumanId: SalesHumanId,
    tenantId: string,
  ): Promise<Result<readonly Lead[], SupabaseError>>;
}
