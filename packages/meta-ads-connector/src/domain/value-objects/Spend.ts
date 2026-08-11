import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** An IDR spend amount — always finite and non-negative (Meta never reports negative spend). */
export class Spend {
  private constructor(private readonly amount: number) {}

  static create(amount: number): Result<Spend, ValidationError> {
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      return err(
        new ValidationError(`Spend amount must be a finite number, received: ${String(amount)}`),
      );
    }
    if (amount < 0) {
      return err(new ValidationError(`Spend amount must not be negative, received: ${amount}`));
    }
    return ok(new Spend(amount));
  }

  static zero(): Spend {
    return new Spend(0);
  }

  toNumber(): number {
    return this.amount;
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  add(other: Spend): Spend {
    return new Spend(this.amount + other.amount);
  }

  equals(other: Spend): boolean {
    return this.amount === other.amount;
  }
}
