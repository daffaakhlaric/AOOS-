import { createHash } from "node:crypto";

import { err, ok, type Result } from "@aos/common";

import type { IEventHasher } from "../../contracts/IEventHasher.js";
import { HashingError } from "../../domain/errors/HashingError.js";
import { HashedName } from "../../domain/value-objects/HashedName.js";
import { HashedPhone } from "../../domain/value-objects/HashedPhone.js";

/** Normalizes `raw` to E.164-without-`+` digits (per Meta CAPI's `ph` field contract). */
export function normalizePhone(raw: string): string {
  return raw.replace(/^\+/, "").replace(/\D/g, "");
}

/** Normalizes `raw` to lowercase, trimmed (per Meta CAPI's `fn` field contract). */
export function normalizeName(raw: string): string {
  return raw.toLowerCase().trim();
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** SHA256(normalize(phone)) — pure function, reused by `EventHasherService` and any mapper that needs the raw hex without a `HashedPhone` wrapper. */
export function hashPhone(phone: string): string {
  return sha256Hex(normalizePhone(phone));
}

/** SHA256(normalize(name)) — pure function, reused by `EventHasherService` and any mapper that needs the raw hex without a `HashedName` wrapper. */
export function hashName(name: string): string {
  return sha256Hex(normalizeName(name));
}

/** SHA256("id") — AAOS always sends `country: "id"` (Indonesia). */
export function hashCountry(): string {
  return sha256Hex("id");
}

/** Hashes the PII fields Meta CAPI requires (`ph`, `fn`, `country`) via SHA256, per the spec's "PII Hashing" section. */
export class EventHasherService implements IEventHasher {
  hashPhone(phone: string): Result<HashedPhone, HashingError> {
    const normalized = normalizePhone(phone);
    if (normalized.length === 0) {
      return err(
        new HashingError(
          `Cannot hash an empty/invalid phone number, received: ${JSON.stringify(phone)}`,
        ),
      );
    }
    const created = HashedPhone.create(sha256Hex(normalized));
    if (!created.ok) {
      return err(new HashingError(created.error.message, { cause: created.error }));
    }
    return ok(created.value);
  }

  hashName(name: string): Result<HashedName, HashingError> {
    const normalized = normalizeName(name);
    if (normalized.length === 0) {
      return err(new HashingError(`Cannot hash an empty name, received: ${JSON.stringify(name)}`));
    }
    const created = HashedName.create(sha256Hex(normalized));
    if (!created.ok) {
      return err(new HashingError(created.error.message, { cause: created.error }));
    }
    return ok(created.value);
  }

  hashCountry(): string {
    return hashCountry();
  }
}
