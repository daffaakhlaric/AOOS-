import { InvalidCronExpressionException } from "../errors/invalid-cron-expression-exception.js";

/**
 * Minimal, in-memory, standard 5-field cron subset: `minute hour day-of-month month day-of-week`.
 *
 * Supported syntax per field:
 *  - `*`            any value
 *  - `N`             a single number
 *  - `N,M,...`       a list of numbers
 *  - `N-M`           an inclusive range
 *  - `*\/S` or `N-M/S`  a step within the full range or a sub-range
 *
 * Field ranges: minute 0-59, hour 0-23, day-of-month 1-31, month 1-12, day-of-week 0-6 (0=Sunday).
 *
 * Semantics match standard cron: when BOTH day-of-month and day-of-week are restricted (i.e.
 * neither is `*`), a timestamp matches if it satisfies EITHER field (OR), not both (AND). When
 * only one is restricted, only that one is enforced. All computation is against UTC fields of the
 * supplied epoch-millisecond timestamp (no local-timezone/DST logic — deliberately out of scope,
 * see README "Known Limitations").
 */

interface FieldSpec {
  readonly min: number;
  readonly max: number;
}

const FIELD_SPECS: readonly FieldSpec[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 6 }, // day of week
];

export interface ParsedCronExpression {
  readonly minute: ReadonlySet<number>;
  readonly hour: ReadonlySet<number>;
  readonly dayOfMonth: ReadonlySet<number>;
  readonly month: ReadonlySet<number>;
  readonly dayOfWeek: ReadonlySet<number>;
  readonly dayOfMonthRestricted: boolean;
  readonly dayOfWeekRestricted: boolean;
  readonly raw: string;
}

function parseFieldPart(part: string, spec: FieldSpec, raw: string): number[] {
  let stepStr: string | undefined;
  let rangeStr = part;
  if (part.includes("/")) {
    const segments = part.split("/");
    if (segments.length !== 2 || segments[0] === "" || segments[1] === "") {
      throw new InvalidCronExpressionException(raw, `invalid step syntax "${part}"`);
    }
    rangeStr = segments[0]!;
    stepStr = segments[1]!;
  }
  const step = stepStr === undefined ? 1 : Number(stepStr);
  if (!Number.isInteger(step) || step <= 0) {
    throw new InvalidCronExpressionException(raw, `invalid step value in "${part}"`);
  }

  let low: number;
  let high: number;
  if (rangeStr === "*") {
    low = spec.min;
    high = spec.max;
  } else if (rangeStr.includes("-")) {
    const segments = rangeStr.split("-");
    if (segments.length !== 2) {
      throw new InvalidCronExpressionException(raw, `invalid range "${rangeStr}"`);
    }
    low = Number(segments[0]);
    high = Number(segments[1]);
    if (!Number.isInteger(low) || !Number.isInteger(high) || low > high) {
      throw new InvalidCronExpressionException(raw, `invalid range "${rangeStr}"`);
    }
  } else {
    low = Number(rangeStr);
    high = low;
    if (!Number.isInteger(low)) {
      throw new InvalidCronExpressionException(raw, `invalid number "${rangeStr}"`);
    }
  }

  if (low < spec.min || high > spec.max) {
    throw new InvalidCronExpressionException(
      raw,
      `value out of range [${spec.min}-${spec.max}] in "${part}"`,
    );
  }

  const values: number[] = [];
  for (let v = low; v <= high; v += step) values.push(v);
  return values;
}

function parseField(field: string, spec: FieldSpec, raw: string): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    if (part === "") throw new InvalidCronExpressionException(raw, "empty field segment");
    for (const v of parseFieldPart(part, spec, raw)) values.add(v);
  }
  return values;
}

export function parseCronExpression(expression: string): ParsedCronExpression {
  const trimmed = expression.trim();
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) {
    throw new InvalidCronExpressionException(expression, `expected 5 fields, got ${fields.length}`);
  }
  const [minuteF, hourF, domF, monthF, dowF] = fields as [string, string, string, string, string];
  const minute = parseField(minuteF, FIELD_SPECS[0]!, expression);
  const hour = parseField(hourF, FIELD_SPECS[1]!, expression);
  const dayOfMonth = parseField(domF, FIELD_SPECS[2]!, expression);
  const month = parseField(monthF, FIELD_SPECS[3]!, expression);
  const dayOfWeek = parseField(dowF, FIELD_SPECS[4]!, expression);

  return {
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek,
    dayOfMonthRestricted: domF !== "*",
    dayOfWeekRestricted: dowF !== "*",
    raw: expression,
  };
}

/** Upper bound on minutes scanned while searching for the next fire time (~4 months). */
const MAX_SEARCH_MINUTES = 200_000;

function matches(parsed: ParsedCronExpression, date: Date): boolean {
  if (!parsed.minute.has(date.getUTCMinutes())) return false;
  if (!parsed.hour.has(date.getUTCHours())) return false;
  if (!parsed.month.has(date.getUTCMonth() + 1)) return false;

  const domMatch = parsed.dayOfMonth.has(date.getUTCDate());
  const dowMatch = parsed.dayOfWeek.has(date.getUTCDay());

  if (parsed.dayOfMonthRestricted && parsed.dayOfWeekRestricted) {
    return domMatch || dowMatch;
  }
  if (parsed.dayOfMonthRestricted) return domMatch;
  if (parsed.dayOfWeekRestricted) return dowMatch;
  return true;
}

/**
 * Computes the next fire time strictly after `fromEpochMs`, minute-resolution, UTC-based. Pure
 * function of `(expression, fromEpochMs)` — no real timers involved. Throws
 * `InvalidCronExpressionException` if no match is found within `MAX_SEARCH_MINUTES` minutes.
 */
export function computeNextCronFireTime(expression: string, fromEpochMs: number): number {
  const parsed = parseCronExpression(expression);
  const start = new Date(fromEpochMs);
  start.setUTCSeconds(0, 0);
  let candidate = new Date(start.getTime() + 60_000);

  for (let i = 0; i < MAX_SEARCH_MINUTES; i++) {
    if (matches(parsed, candidate)) return candidate.getTime();
    candidate = new Date(candidate.getTime() + 60_000);
  }
  throw new InvalidCronExpressionException(
    expression,
    `no matching fire time found within ${MAX_SEARCH_MINUTES} minutes of ${fromEpochMs}`,
  );
}

/**
 * Like `computeNextCronFireTime`, but INCLUSIVE of `fromEpochMs`'s own minute — used when
 * registering a new cron schedule, so a job registered exactly on a matching minute fires
 * immediately rather than waiting for the next occurrence.
 */
export function computeNextCronFireTimeAtOrAfter(expression: string, fromEpochMs: number): number {
  const parsed = parseCronExpression(expression);
  const candidateStart = new Date(fromEpochMs);
  candidateStart.setUTCSeconds(0, 0);
  if (matches(parsed, candidateStart)) return candidateStart.getTime();
  return computeNextCronFireTime(expression, fromEpochMs);
}
