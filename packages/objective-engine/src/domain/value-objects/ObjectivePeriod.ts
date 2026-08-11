import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

export interface ObjectivePeriodInput {
  readonly month: number; // 1-12
  readonly year: number;
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2200;

/** A `{ month, year }` calendar period an Objective targets, e.g. August 2026. */
export class ObjectivePeriod {
  private constructor(
    private readonly month: number,
    private readonly year: number,
  ) {}

  static create(input: ObjectivePeriodInput): Result<ObjectivePeriod, ValidationError> {
    const { month, year } = input;
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return err(
        new ValidationError(
          `ObjectivePeriod.month must be an integer 1-12, received: ${String(month)}`,
        ),
      );
    }
    if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
      return err(
        new ValidationError(
          `ObjectivePeriod.year must be an integer between ${MIN_YEAR} and ${MAX_YEAR}, received: ${String(year)}`,
        ),
      );
    }
    return ok(new ObjectivePeriod(month, year));
  }

  get monthNumber(): number {
    return this.month;
  }

  get yearNumber(): number {
    return this.year;
  }

  /** Total calendar days in this period's month/year (handles leap years via `Date`'s day-0-of-next-month trick). */
  daysInMonth(): number {
    return new Date(this.year, this.month, 0).getDate();
  }

  /** The first instant (00:00:00.000 local) of this period's month. */
  startDate(): Date {
    return new Date(this.year, this.month - 1, 1, 0, 0, 0, 0);
  }

  /** The last instant (23:59:59.999 local) of this period's month. */
  endDate(): Date {
    return new Date(this.year, this.month - 1, this.daysInMonth(), 23, 59, 59, 999);
  }

  /** Whether this period's month/year is the same as or after `now`'s month/year (spec: "period must be current or future month"). */
  isCurrentOrFuture(now: Date): boolean {
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    if (this.year !== nowYear) {
      return this.year > nowYear;
    }
    return this.month >= nowMonth;
  }

  /** A stable string key for per-tenant-per-month uniqueness checks, e.g. "2026-08". */
  toKey(): string {
    return `${this.year}-${String(this.month).padStart(2, "0")}`;
  }

  equals(other: ObjectivePeriod): boolean {
    return this.month === other.month && this.year === other.year;
  }
}
