import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A `SalesHuman`'s currently-open lead count (leads assigned and not yet closed). Non-negative integer. */
export class ActiveLeadCount {
  private constructor(private readonly value: number) {}

  static create(value: number): Result<ActiveLeadCount, ValidationError> {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return err(
        new ValidationError(`ActiveLeadCount must be an integer, received: ${String(value)}`),
      );
    }
    if (value < 0) {
      return err(new ValidationError(`ActiveLeadCount must not be negative, received: ${value}`));
    }
    return ok(new ActiveLeadCount(value));
  }

  static zero(): ActiveLeadCount {
    return new ActiveLeadCount(0);
  }

  toNumber(): number {
    return this.value;
  }

  /** Always valid by construction (adding 1 to a non-negative integer). */
  increment(): ActiveLeadCount {
    return new ActiveLeadCount(this.value + 1);
  }

  /** Clamps at 0 — a defensive floor, never negative. */
  decrement(): ActiveLeadCount {
    return new ActiveLeadCount(Math.max(0, this.value - 1));
  }

  equals(other: ActiveLeadCount): boolean {
    return this.value === other.value;
  }
}
