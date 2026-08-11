import type { Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { WabaAccount } from "../domain/entities/WabaAccount.js";
import type { WabaNotFoundError } from "../domain/errors/index.js";
import type { PhoneNumberId } from "../domain/value-objects/PhoneNumberId.js";

/**
 * Port (Registry Pattern) for the multi-branch WABA registry. The only implementation is
 * `registry/WabaRegistry.ts`.
 */
export interface IWabaRegistry {
  register(account: WabaAccount): void;
  getByPhoneNumberId(phoneNumberId: PhoneNumberId): Result<WabaAccount, WabaNotFoundError>;
  getByBranch(branch: Branch): Result<WabaAccount, WabaNotFoundError>;
  listAll(): ReadonlyArray<WabaAccount>;
}
