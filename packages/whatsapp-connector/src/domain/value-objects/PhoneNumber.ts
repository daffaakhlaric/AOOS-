import { err, ok, type Result } from "@aos/common";

import { InvalidPhoneNumberError } from "../errors/InvalidPhoneNumberError.js";

const E164_ID_PATTERN = /^\+62\d{8,13}$/;

/**
 * An already-normalized `+62xxxxxxxxxx` E.164 Indonesian phone number. `PhoneNumber.create` only
 * accepts a value already in that exact shape — normalizing arbitrary user/Meta input formats
 * (leading `0`, `62`, dashes, ...) into this shape is `utils/PhoneNumberFormatter.normalizeToE164`'s
 * job, kept separate so this value object stays a pure "is this valid E.164?" guard.
 */
export class PhoneNumber {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<PhoneNumber, InvalidPhoneNumberError> {
    if (typeof raw !== "string" || !E164_ID_PATTERN.test(raw)) {
      return err(
        new InvalidPhoneNumberError(
          `PhoneNumber must be a normalized +62 E.164 number, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new PhoneNumber(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }
}
