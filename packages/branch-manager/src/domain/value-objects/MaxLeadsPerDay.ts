import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const MIN = 1;
const MAX = 50;
export const DEFAULT_MAX_LEADS_PER_DAY = 10;

/** A sales human's (or a branch's default) daily lead quota. Bounded `[1, 50]` per the spec's Testing Requirements (`MaxLeadsPerDay.spec.ts ← min 1, max 50`). */
export class MaxLeadsPerDay {
  private constructor(private readonly value: number) {}

  static create(value: number): Result<MaxLeadsPerDay, ValidationError> {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return err(
        new ValidationError(`MaxLeadsPerDay must be an integer, received: ${String(value)}`),
      );
    }
    if (value < MIN || value > MAX) {
      return err(
        new ValidationError(
          `MaxLeadsPerDay must be between ${MIN} and ${MAX} inclusive, received: ${value}`,
        ),
      );
    }
    return ok(new MaxLeadsPerDay(value));
  }

  /** The spec's default of 10 — always valid by construction, so `default()` never needs to expose a `Result`. */
  static default(): MaxLeadsPerDay {
    return new MaxLeadsPerDay(DEFAULT_MAX_LEADS_PER_DAY);
  }

  toNumber(): number {
    return this.value;
  }

  equals(other: MaxLeadsPerDay): boolean {
    return this.value === other.value;
  }
}
