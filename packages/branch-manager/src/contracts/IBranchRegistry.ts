import type { Result } from "@aos/common";

import type { BranchConfig } from "../domain/entities/BranchConfig.js";
import type { BranchConfigError, BranchNotFoundError } from "../domain/errors/index.js";
import type { BranchId } from "../domain/value-objects/BranchId.js";

/** Registry Pattern port for the 4 DSS Motor branches — id-keyed and phone-number-id-keyed lookup, never a scan. */
export interface IBranchRegistry {
  getByBranchId(id: BranchId): Result<BranchConfig, BranchNotFoundError>;
  getByPhoneNumberId(phoneNumberId: string): Result<BranchConfig, BranchNotFoundError>;
  getAll(): readonly BranchConfig[];
  update(config: BranchConfig): Result<BranchConfig, BranchConfigError>;
}
