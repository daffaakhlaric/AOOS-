import { err, type Result } from "@aos/common";

import { InvalidPhoneNumberError } from "../domain/errors/InvalidPhoneNumberError.js";
import { PhoneNumber } from "../domain/value-objects/PhoneNumber.js";

/**
 * Normalizes every Indonesian phone-number format WhatsApp/Meta/local forms present it in, to a
 * single `+62xxxxxxxxxx` E.164 shape. Per the spec's exact rules and examples:
 *
 *   "08123456789"   -> "+628123456789"   (leading 0 -> +62)
 *   "628123456789"  -> "+628123456789"   (bare 62 -> prepend +)
 *   "+628123456789" -> "+628123456789"   (already E.164 -> unchanged)
 *   "8123456789"    -> "+628123456789"   (bare local number, no prefix -> prepend +62)
 *   "0812-3456-789" -> "+628123456789"   (strip dashes first, then apply the 0 -> +62 rule)
 *   "+1234567890"   -> Error             (not an Indonesian number)
 */
export function normalizeToE164(input: string): Result<PhoneNumber, InvalidPhoneNumberError> {
  if (typeof input !== "string" || input.trim().length === 0) {
    return err(new InvalidPhoneNumberError("Phone number input must be a non-empty string"));
  }

  // Strip all non-digit characters except a single leading "+" — handles the dash-stripping case.
  const hasLeadingPlus = input.trim().startsWith("+");
  const digitsOnly = input.replace(/[^\d]/g, "");
  const stripped = hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;

  let candidate: string;
  if (stripped.startsWith("+62")) {
    candidate = stripped;
  } else if (stripped.startsWith("62")) {
    candidate = `+${stripped}`;
  } else if (stripped.startsWith("0")) {
    candidate = `+62${stripped.slice(1)}`;
  } else if (stripped.startsWith("+")) {
    // Has a "+" but not "+62" — a non-Indonesian E.164 number (e.g. "+1234567890").
    return err(
      new InvalidPhoneNumberError(`Phone number "${input}" is not an Indonesian (+62) number`),
    );
  } else {
    // A bare local number with no country/trunk prefix at all (e.g. "8123456789").
    candidate = `+62${stripped}`;
  }

  return PhoneNumber.create(candidate);
}
