import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** Meta CAPI's `event_time` field — Unix seconds (not milliseconds), per Meta's API contract. */
export class EventTime {
  private constructor(private readonly unixSeconds: number) {}

  static fromDate(date: Date): Result<EventTime, ValidationError> {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return err(
        new ValidationError(`EventTime.fromDate requires a valid Date, received: ${String(date)}`),
      );
    }
    return ok(new EventTime(Math.floor(date.getTime() / 1000)));
  }

  static fromUnixSeconds(unixSeconds: number): Result<EventTime, ValidationError> {
    if (!Number.isFinite(unixSeconds) || unixSeconds < 0 || !Number.isInteger(unixSeconds)) {
      return err(
        new ValidationError(`EventTime must be a non-negative integer, received: ${unixSeconds}`),
      );
    }
    return ok(new EventTime(unixSeconds));
  }

  get value(): number {
    return this.unixSeconds;
  }
}
