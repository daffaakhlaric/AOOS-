import { ok, type Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { IWabaRegistry } from "../contracts/IWabaRegistry.js";
import type { WabaNotFoundError } from "../domain/errors/index.js";
import type { PhoneNumberId } from "../domain/value-objects/PhoneNumberId.js";

/**
 * Thin lookup wrapper around `IWabaRegistry.getByPhoneNumberId` — the sole way this package
 * derives which `Branch` an inbound Meta `phone_number_id` belongs to (spec: "detect branch from
 * PhoneNumberId"). Kept as a free function (not a class) since it carries no state of its own
 * beyond the registry it's given.
 */
export function detectBranch(
  registry: IWabaRegistry,
  phoneNumberId: PhoneNumberId,
): Result<Branch, WabaNotFoundError> {
  const found = registry.getByPhoneNumberId(phoneNumberId);
  if (!found.ok) {
    return found;
  }
  return ok(found.value.branch);
}
