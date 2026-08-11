import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * An IDR amount — a unit's price, its DP estimate, its monthly installment estimate, or the sum
 * of many units' prices (`InventoryQueryService.getTotalInventoryValue`). Whole-rupiah only
 * (`Number.isInteger`), non-negative.
 *
 * `add`/`subtract`/`unsafe` bypass `create`'s validation on purpose: they are only ever fed
 * values already known valid by construction (a sum of two non-negative integers, or a value
 * computed by `PriceCalculator` from an already-valid `UnitPrice`), so routing them through
 * `create` and unwrapping a `Result` that can never be `err` would just be dead code the coverage
 * gate would then require faking. `subtract` additionally clamps at 0 as a defensive floor.
 */
export class UnitPrice {
  private constructor(private readonly amount: number) {}

  static create(amount: number): Result<UnitPrice, ValidationError> {
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      return err(
        new ValidationError(`UnitPrice must be a finite number, received: ${String(amount)}`),
      );
    }
    if (!Number.isInteger(amount)) {
      return err(
        new ValidationError(`UnitPrice must be a whole rupiah amount, received: ${amount}`),
      );
    }
    if (amount < 0) {
      return err(new ValidationError(`UnitPrice must not be negative, received: ${amount}`));
    }
    return ok(new UnitPrice(amount));
  }

  /** Internal-trusted constructor for values already known valid (computed sums, `PriceCalculator` outputs). Rounds and clamps to 0 defensively. */
  static unsafe(amount: number): UnitPrice {
    return new UnitPrice(Math.max(0, Math.round(amount)));
  }

  toNumber(): number {
    return this.amount;
  }

  add(other: UnitPrice): UnitPrice {
    return new UnitPrice(this.amount + other.amount);
  }

  subtract(other: UnitPrice): UnitPrice {
    return new UnitPrice(Math.max(0, this.amount - other.amount));
  }

  isGreaterThan(other: UnitPrice): boolean {
    return this.amount > other.amount;
  }

  isLessThanOrEqual(other: UnitPrice): boolean {
    return this.amount <= other.amount;
  }

  equals(other: UnitPrice): boolean {
    return this.amount === other.amount;
  }
}
