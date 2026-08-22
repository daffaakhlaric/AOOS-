import { createHash } from "node:crypto";

/**
 * AAOS-ABTESTING-LOOKALIKE Part 2: normalizes `raw` to digits-only (no leading `+`, no symbols) —
 * Meta's Custom Audience "PHONE" schema field contract. Mirrors
 * `packages/capi-connector/src/application/services/EventHasherService.ts`'s `normalizePhone`
 * (not imported directly — this package has no dependency on `capi-connector`, and the function is
 * a one-line pure transform, not worth a cross-package coupling for).
 */
export function normalizePhoneForAudience(raw: string): string {
  return raw.replace(/^\+/, "").replace(/\D/g, "");
}

/** SHA256(normalizePhoneForAudience(phone)), hex-encoded — Meta requires hashed phone numbers before upload. */
export function hashPhoneForAudience(phone: string): string {
  return createHash("sha256").update(normalizePhoneForAudience(phone)).digest("hex");
}
