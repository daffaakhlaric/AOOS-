import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** Total commission earned (IDR). Never negative. */
export class TotalCommission {
  private constructor(private readonly amount: number) {}

  static create(amount: number): Result<TotalCommission, ValidationError> {
    if (!Number.isFinite(amount) || amount < 0) {
      return err(
        new ValidationError(
          `TotalCommission must be a non-negative finite number, received: ${amount}`,
        ),
      );
    }
    return ok(new TotalCommission(amount));
  }

  static zero(): TotalCommission {
    return new TotalCommission(0);
  }

  /** Sums a list of commission amounts (`undefined` entries treated as 0), the exact pinned-example computation (spec "commission_total"). */
  static fromAmounts(amounts: ReadonlyArray<number | undefined>): TotalCommission {
    const total = amounts.reduce((sum: number, amount) => sum + (amount ?? 0), 0);
    return new TotalCommission(total);
  }

  get value(): number {
    return this.amount;
  }
}
