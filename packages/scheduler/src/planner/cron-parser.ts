import { CronParseException } from "../errors/cron-parse-exception.js";

/** A parsed standard 5-field Cron Expression ("minute hour day-of-month month day-of-week"). */
export interface ParsedCron {
  readonly minutes: ReadonlySet<number>;
  readonly hours: ReadonlySet<number>;
  readonly daysOfMonth: ReadonlySet<number>;
  readonly months: ReadonlySet<number>;
  readonly daysOfWeek: ReadonlySet<number>;
  /** Cron's day-of-month/day-of-week fields are OR-ed when both are restricted, and AND-ed (i.e. the other is ignored) when either is "*" — this flag records which case applies. */
  readonly domIsWildcard: boolean;
  readonly dowIsWildcard: boolean;
}

function parseField(rawField: string, min: number, max: number, fieldName: string): Set<number> {
  const values = new Set<number>();
  for (const part of rawField.split(",")) {
    const [rangePart = "", stepPart] = part.split("/");
    const step = stepPart !== undefined ? Number(stepPart) : 1;
    if (!Number.isInteger(step) || step <= 0) {
      throw new CronParseException(`Invalid step in ${fieldName} field: "${part}"`);
    }

    let rangeStart = min;
    let rangeEnd = max;
    if (rangePart !== "*") {
      if (rangePart.includes("-")) {
        const [startText, endText] = rangePart.split("-");
        const start = Number(startText);
        const end = Number(endText);
        if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
          throw new CronParseException(`Invalid range in ${fieldName} field: "${part}"`);
        }
        rangeStart = start;
        rangeEnd = end;
      } else {
        const value = Number(rangePart);
        if (!Number.isInteger(value)) {
          throw new CronParseException(`Invalid value in ${fieldName} field: "${part}"`);
        }
        rangeStart = value;
        rangeEnd = value;
      }
    }

    if (rangeStart < min || rangeEnd > max) {
      throw new CronParseException(
        `${fieldName} field value out of range [${min}, ${max}]: "${part}"`,
      );
    }
    for (let value = rangeStart; value <= rangeEnd; value += step) {
      values.add(value);
    }
  }
  return values;
}

/** Parses a standard 5-field Cron Expression. Throws `CronParseException` on any malformed field. */
export function parseCronExpression(expression: string): ParsedCron {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new CronParseException(
      `Cron expression must have exactly 5 fields (minute hour day-of-month month day-of-week), got ${fields.length}: "${expression}"`,
    );
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields as [
    string,
    string,
    string,
    string,
    string,
  ];

  return {
    minutes: parseField(minute, 0, 59, "minute"),
    hours: parseField(hour, 0, 23, "hour"),
    daysOfMonth: parseField(dayOfMonth, 1, 31, "day-of-month"),
    months: parseField(month, 1, 12, "month"),
    daysOfWeek: parseField(dayOfWeek, 0, 6, "day-of-week"),
    domIsWildcard: dayOfMonth === "*",
    dowIsWildcard: dayOfWeek === "*",
  };
}
