import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** An IDR daily budget for an AdSet. Non-negative, finite. */
export class Budget {
  private constructor(private readonly amount: number) {}

  static create(amount: number): Result<Budget, ValidationError> {
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      return err(
        new ValidationError(`Budget amount must be a finite number, received: ${String(amount)}`),
      );
    }
    if (amount < 0) {
      return err(new ValidationError(`Budget amount must not be negative, received: ${amount}`));
    }
    return ok(new Budget(amount));
  }

  toNumber(): number {
    return this.amount;
  }

  /** Returns a new Budget scaled by the given factor (e.g. 1.2 for a +20% SCALE verdict), rounded to the nearest whole IDR unit. */
  scaleBy(factor: number): Result<Budget, ValidationError> {
    if (typeof factor !== "number" || !Number.isFinite(factor) || factor <= 0) {
      return err(
        new ValidationError(
          `Budget scale factor must be a positive finite number, received: ${String(factor)}`,
        ),
      );
    }
    return Budget.create(Math.round(this.amount * factor));
  }

  equals(other: Budget): boolean {
    return this.amount === other.amount;
  }
}
