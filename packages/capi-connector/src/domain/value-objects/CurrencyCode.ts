import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** Meta CAPI's `custom_data.currency` field — always `"IDR"` for AAOS (spec pin: all Purchase values are IDR). */
export class CurrencyCode {
  private static readonly IDR_VALUE = "IDR" as const;
  private constructor(private readonly value: "IDR") {}

  static idr(): CurrencyCode {
    return new CurrencyCode(CurrencyCode.IDR_VALUE);
  }

  static create(raw: string): Result<CurrencyCode, ValidationError> {
    if (raw !== CurrencyCode.IDR_VALUE) {
      return err(
        new ValidationError(`CurrencyCode must be "IDR", received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(CurrencyCode.idr());
  }

  toString(): string {
    return this.value;
  }
}
