import type { BranchId } from "@aos/branch-manager";
import type { Result } from "@aos/common";

import type { Closing } from "../domain/entities/Closing.js";
import type { SupabaseError } from "../domain/errors/SupabaseError.js";

/** Repository contract for `closings`. */
export interface IClosingRepository {
  insert(closing: Closing): Promise<Result<Closing, SupabaseError>>;
  findByFilter(filter: ClosingFilter): Promise<Result<readonly Closing[], SupabaseError>>;
}

export interface ClosingFilter {
  readonly campaignId?: string;
  readonly adId?: string;
  readonly branchId?: BranchId;
  /** AAOS-W4B addition: filters to one sales human's own closings — powers "my closings" / personal stats in `apps/aaos-crm`, which has no efficient way to query this without it (a lead's `Closing.salesHumanId` already exists on the entity; this was the missing filter to query by it). */
  readonly salesHumanId?: string;
  readonly fromDate: Date;
  readonly toDate: Date;
}
