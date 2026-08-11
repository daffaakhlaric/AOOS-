import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A `SalesHuman`'s leads assigned today (resets to 0 via `AvailabilityService.resetDailyCounts`). Non-negative integer. */
export class DailyLeadCount {
  private constructor(private readonly value: number) {}

  static create(value: number): Result<DailyLeadCount, ValidationError> {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return err(
        new ValidationError(`DailyLeadCount must be an integer, received: ${String(value)}`),
      );
    }
    if (value < 0) {
      return err(new ValidationError(`DailyLeadCount must not be negative, received: ${value}`));
    }
    return ok(new DailyLeadCount(value));
  }

  static zero(): DailyLeadCount {
    return new DailyLeadCount(0);
  }

  toNumber(): number {
    return this.value;
  }

  /** Always valid by construction (adding 1 to a non-negative integer). */
  increment(): DailyLeadCount {
    return new DailyLeadCount(this.value + 1);
  }

  equals(other: DailyLeadCount): boolean {
    return this.value === other.value;
  }
}
