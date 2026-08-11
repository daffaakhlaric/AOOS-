import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * A whole-Rupiah IDR amount. Unlike `@aos/meta-ads-connector`'s Meta-API-facing `Spend`/`Budget`
 * (which normalize cents), this package never talks to Meta's API directly — it only consumes
 * already-normalized domain objects from `@aos/meta-ads-connector` — so there is no cents concern
 * here; every amount is a non-negative integer number of Rupiah.
 */
export class BudgetAllocation {
  private constructor(private readonly amount: number) {}

  static create(amount: number): Result<BudgetAllocation, ValidationError> {
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      return err(
        new ValidationError(
          `BudgetAllocation must be a finite number, received: ${String(amount)}`,
        ),
      );
    }
    if (!Number.isInteger(amount)) {
      return err(new ValidationError(`BudgetAllocation must be an integer, received: ${amount}`));
    }
    if (amount < 0) {
      return err(new ValidationError(`BudgetAllocation must not be negative, received: ${amount}`));
    }
    return ok(new BudgetAllocation(amount));
  }

  static zero(): BudgetAllocation {
    return new BudgetAllocation(0);
  }

  toNumber(): number {
    return this.amount;
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  add(other: BudgetAllocation): BudgetAllocation {
    return new BudgetAllocation(this.amount + other.amount);
  }

  /** Subtracts, floored at zero (spend never reduces a budget below zero remaining). */
  subtract(other: BudgetAllocation): BudgetAllocation {
    return new BudgetAllocation(Math.max(0, this.amount - other.amount));
  }

  isGreaterThan(other: BudgetAllocation): boolean {
    return this.amount > other.amount;
  }

  isGreaterThanOrEqual(other: BudgetAllocation): boolean {
    return this.amount >= other.amount;
  }

  isLessThan(other: BudgetAllocation): boolean {
    return this.amount < other.amount;
  }

  equals(other: BudgetAllocation): boolean {
    return this.amount === other.amount;
  }
}
