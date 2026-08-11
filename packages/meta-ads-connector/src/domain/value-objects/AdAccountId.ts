import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const AD_ACCOUNT_ID_PATTERN = /^act_\d+$/;

/**
 * The raw Meta ad-account identifier, e.g. "act_752604553578354" — a smart-constructed
 * Value Object (never thrown on invalid input; `.create` returns a `Result`).
 */
export class AdAccountId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<AdAccountId, ValidationError> {
    if (typeof raw !== "string" || !AD_ACCOUNT_ID_PATTERN.test(raw)) {
      return err(
        new ValidationError(
          `AdAccountId must match "act_<digits>", received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new AdAccountId(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: AdAccountId): boolean {
    return this.value === other.value;
  }
}
