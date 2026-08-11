import { err, ok, type Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { IWabaRegistry } from "../contracts/IWabaRegistry.js";
import type { WabaAccount } from "../domain/entities/WabaAccount.js";
import { WabaNotFoundError } from "../domain/errors/index.js";
import type { PhoneNumberId } from "../domain/value-objects/PhoneNumberId.js";

/**
 * `Map<phone_number_id, WabaAccount>` (Registry Pattern), exactly per the spec — the single
 * lookup point every send/receive path uses to resolve which branch a `phoneNumberId` belongs to,
 * or which `phoneNumberId` a `Branch` sends from.
 */
export class WabaRegistry implements IWabaRegistry {
  private readonly byPhoneNumberId = new Map<string, WabaAccount>();
  private readonly byBranch = new Map<Branch, WabaAccount>();

  register(account: WabaAccount): void {
    this.byPhoneNumberId.set(account.phoneNumberId.toString(), account);
    this.byBranch.set(account.branch, account);
  }

  getByPhoneNumberId(phoneNumberId: PhoneNumberId): Result<WabaAccount, WabaNotFoundError> {
    const found = this.byPhoneNumberId.get(phoneNumberId.toString());
    if (found === undefined) {
      return err(
        new WabaNotFoundError(
          `No WabaAccount registered for phone_number_id "${phoneNumberId.toString()}"`,
        ),
      );
    }
    return ok(found);
  }

  getByBranch(branch: Branch): Result<WabaAccount, WabaNotFoundError> {
    const found = this.byBranch.get(branch);
    if (found === undefined) {
      return err(new WabaNotFoundError(`No WabaAccount registered for branch "${String(branch)}"`));
    }
    return ok(found);
  }

  listAll(): ReadonlyArray<WabaAccount> {
    return [...this.byPhoneNumberId.values()];
  }
}
