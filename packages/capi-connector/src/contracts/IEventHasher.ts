import type { Result } from "@aos/common";

import type { HashingError } from "../domain/errors/HashingError.js";
import type { HashedName } from "../domain/value-objects/HashedName.js";
import type { HashedPhone } from "../domain/value-objects/HashedPhone.js";

/** Port for hashing the PII fields Meta CAPI requires (`EventHasherService` is the only implementation). */
export interface IEventHasher {
  hashPhone(phone: string): Result<HashedPhone, HashingError>;
  hashName(name: string): Result<HashedName, HashingError>;
  hashCountry(): string;
}
