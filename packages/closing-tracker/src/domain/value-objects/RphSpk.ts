import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** Rp spent per SPK (IDR) — the primary Samantha feed-back metric. Never negative. */
export class RphSpk {
  private constructor(private readonly amount: number) {}

  static create(amount: number): Result<RphSpk, ValidationError> {
    if (!Number.isFinite(amount) || amount < 0) {
      return err(
        new ValidationError(`RphSpk must be a non-negative finite number, received: ${amount}`),
      );
    }
    return ok(new RphSpk(amount));
  }

  /** `spend / spkCount`, divide-by-zero-safe: `spkCount <= 0` resolves to `RphSpk(0)`, never `NaN`/`Infinity`. */
  static fromSpendAndSpk(spend: number, spkCount: number): RphSpk {
    if (spkCount <= 0) {
      return new RphSpk(0);
    }
    return new RphSpk(spend / spkCount);
  }

  get value(): number {
    return this.amount;
  }
}
