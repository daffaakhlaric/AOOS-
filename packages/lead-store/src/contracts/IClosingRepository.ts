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
  readonly fromDate: Date;
  readonly toDate: Date;
}
