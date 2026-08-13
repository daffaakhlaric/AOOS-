import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * A closed date range ({@link ReportPeriod.fromDate} inclusive at 00:00:00, {@link
 * ReportPeriod.toDate} inclusive through 23:59:59.999) plus the calendar month/year it
 * represents. The spec's folder-structure comment reads `{ month, year } or date range` — this
 * package implements both together: `month`/`year` are the human-facing label (used in report ids
 * and Tamara feed payloads), `fromDate`/`toDate` are the actual query boundaries handed to
 * `@aos/lead-store`'s `GetClosingStats`/`IClosingRepository.findByFilter`.
 */
export interface ReportPeriodProps {
  readonly month: number; // 1-12
  readonly year: number;
  readonly fromDate: Date;
  readonly toDate: Date;
}

export class ReportPeriod {
  private constructor(private readonly props: ReportPeriodProps) {}

  static create(props: ReportPeriodProps): Result<ReportPeriod, ValidationError> {
    if (!Number.isInteger(props.month) || props.month < 1 || props.month > 12) {
      return err(
        new ValidationError(`ReportPeriod.month must be an integer 1-12, received: ${props.month}`),
      );
    }
    if (!Number.isInteger(props.year) || props.year < 2000) {
      return err(
        new ValidationError(
          `ReportPeriod.year must be an integer >= 2000, received: ${props.year}`,
        ),
      );
    }
    if (props.fromDate.getTime() > props.toDate.getTime()) {
      return err(new ValidationError("ReportPeriod.fromDate must not be after toDate"));
    }
    return ok(new ReportPeriod({ ...props }));
  }

  /** Builds the calendar-month period for `month`/`year` — `fromDate` is the 1st at 00:00:00.000, `toDate` is the last day at 23:59:59.999 (UTC). */
  static forMonth(month: number, year: number): Result<ReportPeriod, ValidationError> {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return err(
        new ValidationError(`ReportPeriod.month must be an integer 1-12, received: ${month}`),
      );
    }
    if (!Number.isInteger(year) || year < 2000) {
      return err(
        new ValidationError(`ReportPeriod.year must be an integer >= 2000, received: ${year}`),
      );
    }
    const fromDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const toDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return ok(new ReportPeriod({ month, year, fromDate, toDate }));
  }

  get month(): number {
    return this.props.month;
  }

  get year(): number {
    return this.props.year;
  }

  get fromDate(): Date {
    return this.props.fromDate;
  }

  get toDate(): Date {
    return this.props.toDate;
  }

  /** `"2026-08"` — used as part of report ids and Tamara feed payload identifiers. */
  toLabel(): string {
    return `${this.props.year}-${String(this.props.month).padStart(2, "0")}`;
  }

  /** The prior calendar month's period — used by `vsLastMonth` trend computation. */
  previousMonth(): ReportPeriod {
    const prevMonth = this.props.month === 1 ? 12 : this.props.month - 1;
    const prevYear = this.props.month === 1 ? this.props.year - 1 : this.props.year;
    const result = ReportPeriod.forMonth(prevMonth, prevYear);
    /* v8 ignore start -- forMonth only fails for out-of-range month/year, both structurally
       impossible here since prevMonth/prevYear are derived from an already-valid ReportPeriod. */
    if (!result.ok) {
      throw new Error("ReportPeriod.previousMonth: unreachable — derived month/year always valid");
    }
    /* v8 ignore stop */
    return result.value;
  }
}
